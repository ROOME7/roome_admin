// Finances data layer — pulls Roome's earnings straight from Stripe.
//
// Roome makes money two ways:
//   1. Owner subscriptions — €150/year recurring. The whole charge is ours.
//   2. Rent service fees    — €2 + 3% of rent, retained as an
//      `application_fee_amount` on each destination-charge rent invoice.
//
// The single source of truth for "what Roome actually earned" is the
// platform's Stripe balance ledger: every euro in or out shows up as a
// BalanceTransaction with amount / fee / net. Summing `net` over every
// non-payout transaction is — by construction — exactly the money that
// landed in (or left) Roome's account, regardless of direct-vs-destination
// charge nuances or who bears the Stripe processing fee.
//
// We fetch the year-to-date ledger once (paginated, capped) and derive
// month-to-date, the charts, and the payments trail from that one dataset.
//
// At launch volume this is a couple of Stripe round-trips per page load,
// which is fine. If the ledger grows past a few thousand transactions a
// year, move this to a nightly Firestore rollup and read that instead.

import 'server-only';
import type Stripe from 'stripe';
import { serverStripe } from '@/lib/stripe';
import { serverDb } from '@/lib/firebase-admin';

const MAX_TXNS = 5000;
const ROME_TZ = 'Europe/Rome';

// Payout transactions just move money from the Stripe balance to the bank —
// they are not earnings, so they're excluded from the net-earnings sum
// (including them would zero it out against the inbound charges).
const PAYOUT_TYPES = new Set(['payout', 'payout_cancel', 'payout_failure']);

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Rome-local date helpers — admins and the business operate on Italian time,
// so month / year boundaries must be Rome midnight, not UTC midnight.
// ---------------------------------------------------------------------------

function romeOffsetMs(at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  const asUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second
  );
  return asUtc - at.getTime();
}

interface RomeYmd {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

function romeYmd(at: Date): RomeYmd {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: ROME_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day };
}

// Unix seconds for Rome-local midnight at the start of the given Y-M-D.
function romeMidnightUnix(year: number, month: number, day: number): number {
  const guessUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = romeOffsetMs(new Date(guessUtc));
  return Math.floor((guessUtc - offset) / 1000);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoneyBuckets {
  /** Σ net over every non-payout balance transaction — the true bottom line. */
  netEarnings: number;
  /** netEarnings + Stripe per-transaction processing fees. */
  grossCut: number;
  /** Σ of Stripe's per-transaction processing fees. */
  stripeFees: number;
  /** Σ amount of every inbound charge — total money processed (GMV). */
  volume: number;
  /** Σ of transfers routed out to landlord Connect accounts. */
  landlordPayouts: number;
  /** Σ of refunded amounts (shown as a positive number). */
  refunds: number;
  ownerSub: { count: number; volume: number; net: number };
  rent: { count: number; volume: number; fees: number };
  txnCount: number;
}

export type PaymentKind = 'subscription' | 'rent' | 'other';

export interface PaymentRow {
  id: string;
  created: Date;
  kind: PaymentKind;
  payerName: string | null;
  payerEmail: string | null;
  payerUid: string | null;
  /** What the payer was charged. */
  gross: number;
  /** What Roome kept: full charge for subs, the service fee for rent. */
  roomeCut: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface FinanceData {
  mtd: MoneyBuckets;
  ytd: MoneyBuckets;
  /** Net earnings per day, current month. */
  daily: ChartPoint[];
  /** Net earnings per month, current year. */
  monthly: ChartPoint[];
  /** Every inbound payment this year, newest first. */
  payments: PaymentRow[];
  monthLabel: string;
  yearLabel: string;
  /** True if the ledger fetch hit MAX_TXNS — figures may be incomplete. */
  truncated: boolean;
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function chargeOf(txn: Stripe.BalanceTransaction): Stripe.Charge | null {
  const s = txn.source;
  if (s && typeof s === 'object' && (s as { object?: string }).object === 'charge') {
    return s as Stripe.Charge;
  }
  return null;
}

// Rent is paid as a destination charge (transfer_data routes settlement to
// the landlord) and carries an application_fee. An owner subscription is a
// plain invoice-linked charge with neither.
function classifyCharge(charge: Stripe.Charge): PaymentKind {
  if (charge.transfer_data?.destination) return 'rent';
  if ((charge.application_fee_amount ?? 0) > 0) return 'rent';
  if (charge.invoice) return 'subscription';
  return 'other';
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function emptyBuckets(): MoneyBuckets {
  return {
    netEarnings: 0,
    grossCut: 0,
    stripeFees: 0,
    volume: 0,
    landlordPayouts: 0,
    refunds: 0,
    ownerSub: { count: 0, volume: 0, net: 0 },
    rent: { count: 0, volume: 0, fees: 0 },
    txnCount: 0,
  };
}

function computeBuckets(txns: Stripe.BalanceTransaction[]): MoneyBuckets {
  const b = emptyBuckets();
  for (const t of txns) {
    b.txnCount += 1;
    if (!PAYOUT_TYPES.has(t.type)) {
      b.netEarnings += t.net;
      b.stripeFees += t.fee;
    }
    if (t.type === 'charge' || t.type === 'payment') {
      b.volume += t.amount;
      const charge = chargeOf(t);
      const kind = charge ? classifyCharge(charge) : 'other';
      if (kind === 'subscription') {
        b.ownerSub.count += 1;
        b.ownerSub.volume += t.amount;
        b.ownerSub.net += t.net;
      } else if (kind === 'rent') {
        b.rent.count += 1;
        b.rent.volume += t.amount;
        b.rent.fees += charge?.application_fee_amount ?? 0;
      }
    } else if (t.type === 'transfer') {
      // Outbound transfers debit the platform balance (negative amount).
      if (t.amount < 0) b.landlordPayouts += -t.amount;
    } else if (t.type === 'refund' || t.type === 'payment_refund') {
      b.refunds += -t.net;
    }
  }
  b.grossCut = b.netEarnings + b.stripeFees;
  return b;
}

// ---------------------------------------------------------------------------
// Payer resolution — map Stripe customer IDs back to Roome users.
// ---------------------------------------------------------------------------

interface Payer {
  uid: string;
  name: string | null;
  email: string | null;
}

async function resolvePayers(
  customerIds: string[]
): Promise<Map<string, Payer>> {
  const out = new Map<string, Payer>();
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (unique.length === 0) return out;

  const db = serverDb();
  // Firestore `in` queries take up to 30 values per round-trip.
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where('stripeCustomerId', 'in', chunk)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const cid = d.stripeCustomerId;
      if (typeof cid !== 'string') continue;
      const parts = [d.name, d.surname]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(' ')
        .trim();
      const name =
        (typeof d.fullName === 'string' && d.fullName.trim()) ||
        parts ||
        (typeof d.companyName === 'string' && d.companyName.trim()) ||
        (typeof d.displayUsername === 'string' && d.displayUsername.trim()) ||
        null;
      out.set(cid, {
        uid: doc.id,
        name: name || null,
        email: typeof d.email === 'string' ? d.email : null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export async function loadFinanceData(): Promise<FinanceData> {
  const stripe = serverStripe();
  const now = new Date();
  const today = romeYmd(now);
  const yearStart = romeMidnightUnix(today.year, 1, 1);
  const monthStart = romeMidnightUnix(today.year, today.month, 1);

  // One paginated pull of the year-to-date ledger, sources expanded so we
  // can classify each charge without an N+1 of per-charge fetches.
  const txns = await stripe.balanceTransactions
    .list({
      created: { gte: yearStart },
      limit: 100,
      expand: ['data.source'],
    })
    .autoPagingToArray({ limit: MAX_TXNS });
  const truncated = txns.length >= MAX_TXNS;

  const mtdTxns = txns.filter((t) => t.created >= monthStart);

  // Net earnings per day (this month) and per month (this year).
  const dayTotals = new Map<number, number>();
  const monthTotals = new Map<number, number>();
  for (const t of txns) {
    if (PAYOUT_TYPES.has(t.type)) continue;
    const d = romeYmd(new Date(t.created * 1000));
    if (d.year !== today.year) continue;
    monthTotals.set(d.month, (monthTotals.get(d.month) ?? 0) + t.net);
    if (d.month === today.month) {
      dayTotals.set(d.day, (dayTotals.get(d.day) ?? 0) + t.net);
    }
  }
  const daily: ChartPoint[] = [];
  for (let day = 1; day <= today.day; day += 1) {
    daily.push({ label: String(day), value: dayTotals.get(day) ?? 0 });
  }
  const monthly: ChartPoint[] = [];
  for (let m = 1; m <= today.month; m += 1) {
    monthly.push({ label: MONTH_LABELS[m - 1], value: monthTotals.get(m) ?? 0 });
  }

  // Payments trail — every inbound charge this year, newest first.
  const chargeTxns = txns
    .filter((t) => t.type === 'charge' || t.type === 'payment')
    .sort((a, b) => b.created - a.created);

  const customerIds: string[] = [];
  for (const t of chargeTxns) {
    const c = chargeOf(t);
    if (c && typeof c.customer === 'string') customerIds.push(c.customer);
  }
  const payers = await resolvePayers(customerIds);

  const payments: PaymentRow[] = chargeTxns.map((t) => {
    const charge = chargeOf(t);
    const kind: PaymentKind = charge ? classifyCharge(charge) : 'other';
    const customerId =
      charge && typeof charge.customer === 'string' ? charge.customer : null;
    const payer = customerId ? payers.get(customerId) : undefined;
    const roomeCut =
      kind === 'rent' ? charge?.application_fee_amount ?? 0 : t.net;
    return {
      id: t.id,
      created: new Date(t.created * 1000),
      kind,
      payerName: payer?.name ?? null,
      payerEmail:
        payer?.email ??
        charge?.billing_details?.email ??
        charge?.receipt_email ??
        null,
      payerUid: payer?.uid ?? null,
      gross: t.amount,
      roomeCut,
    };
  });

  return {
    mtd: computeBuckets(mtdTxns),
    ytd: computeBuckets(txns),
    daily,
    monthly,
    payments,
    monthLabel: new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: ROME_TZ,
    }).format(now),
    yearLabel: String(today.year),
    truncated,
    generatedAt: now,
  };
}
