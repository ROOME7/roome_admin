// /managed/[uid]/operate — On-behalf actions for a single managed account.
//
// Server Component. Reads the partner's chats / listings / pending
// applications via firebase-admin (bypasses rules) and renders the three
// tabs. Each tab's action dialogs are client components that call the
// server actions in ./actions.ts.
//
// Per docs/architecture/admin-panel-roadmap.md T3 (option A — server-action
// proxy): NO impersonation sessions, NO second Firebase Auth instance,
// NO custom token. The admin's session in the panel is the only auth
// context. The audit trail is the `_impersonatedByAdminUid` stamp on each
// affected doc + the `adminAccountActions` log.

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Timestamp } from 'firebase-admin/firestore';
import { serverDb } from '@/lib/firebase-admin';
import type {
  OperateApplicationSummary,
  OperateChatsSummary,
  OperateListingSummary,
  StripePartnerSnapshot,
} from './actions';
import { getStripePartnerSnapshot } from './actions';
import { ChatsTab } from './_components/chats-tab';
import { ListingsTab } from './_components/listings-tab';
import { ApplicationsTab } from './_components/applications-tab';
import { StripeTab } from './_components/stripe-tab';

const OPERATE_TABS = ['chats', 'listings', 'applications', 'stripe'] as const;
type OperateTab = (typeof OPERATE_TABS)[number];

function asTab(raw: string | string[] | undefined): OperateTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (OPERATE_TABS as readonly string[]).includes(v ?? '')
    ? (v as OperateTab)
    : 'chats';
}

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

async function loadPartner(uid: string) {
  const db = serverDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName:
      typeof data.companyName === 'string'
        ? data.companyName
        : typeof data.displayUsername === 'string'
          ? data.displayUsername
          : '(unnamed)',
    isManaged: Boolean(data.managedBy),
    isSuspended: Boolean(data.suspended?.active),
    isArchived: Boolean(data.deletedAt),
  };
}

async function loadChats(uid: string): Promise<OperateChatsSummary[]> {
  const db = serverDb();
  // Partner may be tenant or landlord in any given chat. Two queries.
  //
  // NOTE: we deliberately don't .orderBy('updatedAt') here even though we
  // want most-recent-first, because the composite indexes
  // (landlordId/tenantId × updatedAt desc) aren't deployed yet — see
  // firestore.indexes.json. Sort happens in memory after the union below.
  // For partner volumes under ~50 chats this is fine. To restore proper
  // ordering+pagination, run `firebase deploy --only firestore:indexes`
  // and put the .orderBy back.
  const [asLandlord, asTenant] = await Promise.all([
    db
      .collection('chats')
      .where('landlordId', '==', uid)
      .limit(50)
      .get(),
    db
      .collection('chats')
      .where('tenantId', '==', uid)
      .limit(50)
      .get(),
  ]);

  const out: OperateChatsSummary[] = [];
  const seen = new Set<string>();
  for (const doc of [...asLandlord.docs, ...asTenant.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const d = doc.data();
    const counterparty = d.landlordId === uid ? d.tenantId : d.landlordId;
    const last = (d.lastMessage ?? {}) as Record<string, unknown>;
    out.push({
      chatId: doc.id,
      counterpartyUid: typeof counterparty === 'string' ? counterparty : '',
      lastMessageText:
        typeof last.text === 'string' ? (last.text as string) : null,
      lastMessageAt: tsToDate(last.sentAt),
      unread:
        d.unread && typeof d.unread === 'object'
          ? (d.unread[uid] as number) ?? 0
          : 0,
    });
  }
  out.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  return out;
}

async function loadListings(uid: string): Promise<OperateListingSummary[]> {
  const db = serverDb();
  const snap = await db
    .collection('listings')
    .where('ownerId', '==', uid)
    .limit(100)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    const search = (d.search ?? {}) as Record<string, unknown>;
    const ideal = (d.idealTenant ?? {}) as Record<string, unknown>;
    return {
      listingId: doc.id,
      propertyId: typeof d.propertyId === 'string' ? d.propertyId : '',
      status: typeof d.status === 'string' ? d.status : 'unknown',
      region: typeof search.region === 'string' ? (search.region as string) : null,
      province:
        typeof search.province === 'string'
          ? (search.province as string)
          : null,
      description: typeof d.description === 'string' ? d.description : '',
      inAppRentPaymentEnabled: Boolean(d.inAppRentPaymentEnabled),
      rentDueDayOfMonth:
        typeof d.rentDueDayOfMonth === 'number' ? d.rentDueDayOfMonth : null,
      idealTenant: {
        ageMin: typeof ideal.ageMin === 'number' ? (ideal.ageMin as number) : null,
        ageMax: typeof ideal.ageMax === 'number' ? (ideal.ageMax as number) : null,
        genderPref:
          typeof ideal.genderPref === 'string'
            ? (ideal.genderPref as string)
            : 'any',
        occupationPref:
          typeof ideal.occupationPref === 'string'
            ? (ideal.occupationPref as string)
            : 'any',
        preferredUniversityId:
          typeof ideal.preferredUniversityId === 'string'
            ? (ideal.preferredUniversityId as string)
            : null,
      },
      preferredStayLengthMonths:
        typeof d.preferredStayLengthMonths === 'number'
          ? d.preferredStayLengthMonths
          : null,
      availabilityDate: tsToDate(d.availabilityDate),
    };
  });
}

async function loadApplications(
  uid: string
): Promise<OperateApplicationSummary[]> {
  const db = serverDb();
  // Same caveat as loadChats: no .orderBy('appliedAt') here because the
  // composite index (landlordId × status × appliedAt desc) isn't deployed
  // yet. Sort in memory below. See firestore.indexes.json for the
  // pre-staged index definition.
  const snap = await db
    .collection('contracts')
    .where('landlordId', '==', uid)
    .where('status', '==', 'pending')
    .limit(50)
    .get();

  const out = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      contractId: doc.id,
      tenantId: typeof d.tenantId === 'string' ? d.tenantId : '',
      tenantDisplayName:
        typeof d.tenantDisplayName === 'string' ? d.tenantDisplayName : '(tenant)',
      roomId: typeof d.roomId === 'string' ? d.roomId : '',
      listingId: typeof d.listingId === 'string' ? d.listingId : null,
      appliedAt: tsToDate(d.appliedAt),
    };
  });
  out.sort(
    (a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0)
  );
  return out;
}

type SearchParams = Promise<{ tab?: string }>;
type Params = Promise<{ uid: string }>;

export default async function OperatePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { uid } = await params;
  const sp = await searchParams;
  const tab = asTab(sp.tab);

  const partner = await loadPartner(uid);
  if (!partner) notFound();

  // Read-only banner for non-actionable states (suspended/archived). We
  // still render tabs so admin can SEE state, but the action dialogs
  // refuse to write.
  const lockedReason = !partner.isManaged
    ? 'not_managed'
    : partner.isSuspended
      ? 'suspended'
      : partner.isArchived
        ? 'archived'
        : null;

  // Lazily fetch only the tab's data set to keep page loads cheap.
  const emptyStripe: StripePartnerSnapshot = {
    hasStripeFootprint: false,
    customer: null,
    customerError: null,
    subscription: null,
    subscriptionError: null,
    connect: null,
    connectError: null,
    invoices: [],
    invoicesError: null,
    payments: [],
    paymentsError: null,
    disputes: [],
    disputesError: null,
  };
  const [chats, listings, applications, stripe] = await Promise.all([
    tab === 'chats' ? loadChats(uid) : Promise.resolve([] as OperateChatsSummary[]),
    tab === 'listings'
      ? loadListings(uid)
      : Promise.resolve([] as OperateListingSummary[]),
    tab === 'applications'
      ? loadApplications(uid)
      : Promise.resolve([] as OperateApplicationSummary[]),
    tab === 'stripe'
      ? getStripePartnerSnapshot(uid).then((res) =>
          res.ok ? res.snapshot : emptyStripe
        )
      : Promise.resolve(emptyStripe),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/managed" className="hover:text-foreground">
            ← Active Management
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Operate on behalf of <span className="text-primary">{partner.displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Every action you take here is recorded with{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">_impersonatedByAdminUid</code>
          {' '}stamped on the affected doc. No partner notification is sent.
        </p>
      </header>

      {lockedReason && <LockedBanner reason={lockedReason} />}

      <TabsRow uid={uid} active={tab} />

      {tab === 'chats' && (
        <ChatsTab uid={uid} chats={chats} disabled={Boolean(lockedReason)} />
      )}
      {tab === 'listings' && (
        <ListingsTab uid={uid} listings={listings} disabled={Boolean(lockedReason)} />
      )}
      {tab === 'applications' && (
        <ApplicationsTab
          uid={uid}
          applications={applications}
          disabled={Boolean(lockedReason)}
        />
      )}
      {tab === 'stripe' && <StripeTab snapshot={stripe} />}
    </div>
  );
}

function TabsRow({ uid, active }: { uid: string; active: OperateTab }) {
  const tabs: { value: OperateTab; label: string }[] = [
    { value: 'chats', label: 'Chats' },
    { value: 'listings', label: 'Listings' },
    { value: 'applications', label: 'Applications' },
    { value: 'stripe', label: 'Stripe' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Operate-as tabs"
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={`/managed/${uid}/operate?tab=${t.value}`}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function LockedBanner({
  reason,
}: {
  reason: 'not_managed' | 'suspended' | 'archived';
}) {
  const messages: Record<typeof reason, { tone: string; text: string }> = {
    not_managed: {
      tone: 'bg-muted/50 text-muted-foreground',
      text: 'This account is not currently managed. Operate actions are disabled. Use Reclaim or Create instead.',
    },
    suspended: {
      tone: 'bg-amber-500/10 text-amber-700',
      text: 'This account is suspended. Operate actions are disabled until you reactivate it.',
    },
    archived: {
      tone: 'bg-destructive/10 text-destructive',
      text: 'This account is archived. Operate actions are disabled.',
    },
  };
  const m = messages[reason];
  return (
    <p className={`rounded-md px-4 py-2 text-sm ${m.tone}`}>{m.text}</p>
  );
}
