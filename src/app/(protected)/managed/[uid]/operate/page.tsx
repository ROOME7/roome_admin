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
import { getStripePartnerSnapshot, loadTenantProfiles } from './actions';
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
  // Query by `participants array-contains` — the canonical Flutter chat
  // membership field. The old landlordId/tenantId pair of queries missed
  // invite-chats created by add_house_screen.dart (which writes only
  // `participants`). A single array-contains needs no composite index.
  const snap = await db
    .collection('chats')
    .where('participants', 'array-contains', uid)
    .limit(100)
    .get();

  // SCHEMA NOTE (2026-05-19 fix): the Flutter chat doc stores `lastMessage`
  // as a STRING, the rollup timestamp as `lastUpdate`, and derives unread
  // from `isRead` + `lastSenderId` — there is no per-user `unread` map.
  // The previous loader read a v2 shape the app never adopted, so the
  // preview + timestamp + unread badge were always blank.
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    const participants: string[] = Array.isArray(d.participants)
      ? (d.participants.filter((p: unknown): p is string => typeof p === 'string'))
      : [];
    const counterparty =
      participants.find((p) => p !== uid) ??
      (d.landlordId === uid ? d.tenantId : d.landlordId) ??
      '';
    const lastSenderId =
      typeof d.lastSenderId === 'string' ? d.lastSenderId : '';
    // Flutter Chat.hasUnreadFor: !isRead && lastSenderId != uid.
    const isRead = d.isRead !== false;
    return {
      chatId: doc.id,
      counterpartyUid: typeof counterparty === 'string' ? counterparty : '',
      lastMessageText:
        typeof d.lastMessage === 'string' ? (d.lastMessage as string) : null,
      lastMessageAt: tsToDate(d.lastUpdate) ?? tsToDate(d.updatedAt),
      hasUnread: !isRead && lastSenderId !== '' && lastSenderId !== uid,
    };
  });

  // Resolve each counterparty's profile so the chat list shows a name +
  // age instead of a raw uid (2026-05-19 client feedback).
  const profiles = await loadTenantProfiles(
    rows.map((r) => r.counterpartyUid)
  );

  const out: OperateChatsSummary[] = rows.map((r) => {
    const p = profiles.get(r.counterpartyUid);
    return {
      ...r,
      counterpartyName: p?.displayName ?? null,
      counterpartyPhotoUrl: p?.photoUrl ?? null,
      counterpartyAge: p?.age ?? null,
      counterpartyProfession: p?.profession ?? null,
    };
  });
  out.sort(
    (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)
  );
  return out;
}

async function loadListings(uid: string): Promise<OperateListingSummary[]> {
  const db = serverDb();
  const snap = await db
    .collection('listings')
    .where('ownerId', '==', uid)
    .limit(100)
    .get();

  // Listings don't carry photoUrls — the `_rebuildListingForProperty` trigger
  // skips them, so the URLs live on the parent property docs. One batched
  // getAll() pulls every referenced property in a single network round-trip
  // so we can fill in the thumbnail strip in the admin UI.
  const propertyIds = snap.docs
    .map((doc) => {
      const d = doc.data();
      return typeof d.propertyId === 'string' ? d.propertyId : '';
    })
    .filter((id) => id !== '');
  const photoUrlsByPropertyId = new Map<string, string[]>();
  if (propertyIds.length > 0) {
    const propRefs = propertyIds.map((id) => db.collection('properties').doc(id));
    const propSnaps = await db.getAll(...propRefs);
    for (const propSnap of propSnaps) {
      if (!propSnap.exists) continue;
      const data = propSnap.data() ?? {};
      const urls = Array.isArray(data.photoUrls)
        ? (data.photoUrls.filter(
            (u): u is string => typeof u === 'string' && u.length > 0
          ) as string[])
        : [];
      photoUrlsByPropertyId.set(propSnap.id, urls);
    }
  }

  return snap.docs.map((doc) => {
    const d = doc.data();
    const search = (d.search ?? {}) as Record<string, unknown>;
    const ideal = (d.idealTenant ?? {}) as Record<string, unknown>;
    const propertyId = typeof d.propertyId === 'string' ? d.propertyId : '';
    return {
      listingId: doc.id,
      propertyId,
      status: typeof d.status === 'string' ? d.status : 'unknown',
      region: typeof search.region === 'string' ? (search.region as string) : null,
      province:
        typeof search.province === 'string'
          ? (search.province as string)
          : null,
      description: typeof d.description === 'string' ? d.description : '',
      photoUrls: photoUrlsByPropertyId.get(propertyId) ?? [],
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

  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      contractId: doc.id,
      tenantId: typeof d.tenantId === 'string' ? d.tenantId : '',
      tenantDisplayName:
        typeof d.tenantDisplayName === 'string' ? d.tenantDisplayName : '(tenant)',
      roomId: typeof d.roomId === 'string' ? d.roomId : '',
      listingId: typeof d.listingId === 'string' ? d.listingId : null,
      // Contract docs use `timestamp` (add_house_screen) or `appliedAt`
      // depending on the path that created them — tolerate both.
      appliedAt: tsToDate(d.appliedAt) ?? tsToDate(d.timestamp),
    };
  });

  // Resolve applicant profiles so the admin sees name / age / occupation /
  // behaviour — the same screening view a private owner gets on the
  // Flutter tenant-request-detail screen (2026-05-19 client feedback).
  const profiles = await loadTenantProfiles(rows.map((r) => r.tenantId));

  const out: OperateApplicationSummary[] = rows.map((r) => ({
    ...r,
    profile: profiles.get(r.tenantId) ?? null,
  }));
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
