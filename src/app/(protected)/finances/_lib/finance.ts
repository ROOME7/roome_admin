// Finances — the shapes the screen renders, and one call to fetch them.
//
// ⚠️ THE LEDGER MATH MOVED TO THE API, AND THE STRIPE KEY WENT WITH IT. This
// file used to call Stripe directly, which meant the admin panel held a secret
// key that can move money. It also resolved payers from a Firestore
// `users.stripeCustomerId` field that does not exist in the new database, so
// every row of the payments trail showed an unattributed payment — a screen
// that looked right and was not.
//
// What Roome earns is unchanged: owner subscriptions, where the whole charge
// is ours, and rent service fees retained as an application fee on each
// destination-charge rent invoice. All amounts below are in CENTS.

import 'server-only';
import { apiAuthed } from '@/lib/session';

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
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


/** The wire shape: identical, but dates are ISO strings. */
type ApiFinance = Omit<FinanceData, 'payments' | 'generatedAt'> & {
  payments: (Omit<PaymentRow, 'created'> & { created: string })[];
  generatedAt: string;
};

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

export async function loadFinanceData(): Promise<FinanceData> {
  const res = await apiAuthed<ApiFinance>('/admin/finance');

  const now = new Date();
  if (!res) {
    // A box with no Stripe key answers 503, which `apiAuthed` raises rather
    // than returning — this is the 404/204 path. Zeroes beat a crash, and
    // `truncated` says the figures are not to be trusted.
    return {
      mtd: emptyBuckets(),
      ytd: emptyBuckets(),
      daily: [],
      monthly: [],
      payments: [],
      monthLabel: new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Rome',
      }).format(now),
      yearLabel: String(now.getFullYear()),
      truncated: true,
      generatedAt: now,
    };
  }

  return {
    ...res,
    payments: res.payments.map((p) => ({ ...p, created: new Date(p.created) })),
    generatedAt: new Date(res.generatedAt),
  };
}
