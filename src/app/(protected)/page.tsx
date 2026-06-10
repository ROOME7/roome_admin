// Dashboard — at-a-glance counters + most recent admin actions feed.
//
// All read-only. Counts come from Firestore aggregate `.count()` queries
// (cheap; doesn't transfer doc bodies). Recent activity reads the last 20
// adminAccountActions entries and renders via the shared formatAdminAction
// formatter so the same admin action shows identical copy here and in the
// per-account Activity dialog (T5 Item 17).
//
// The dashboard intentionally has no caching layer — counters move slowly
// enough that a fresh read on every page load is fine, and a stale cache
// here is a worse experience than a 300ms read.

import 'server-only';
import Link from 'next/link';
import { serverDb } from '@/lib/firebase-admin';
import { getRecentAdminActions } from '@/lib/audit';
import {
  formatAdminAction,
  type AdminActionEntry,
} from '@/lib/audit-format';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

type Counts = {
  pendingB2b: number;
  managed: number;
  suspended: number;
  tenants: number;
  landlords: number;
  activeListings: number;
  properties: number;
  activeTenancies: number;
  pendingApplications: number;
  openReports: number;
};

const EMPTY_COUNTS: Counts = {
  pendingB2b: 0,
  managed: 0,
  suspended: 0,
  tenants: 0,
  landlords: 0,
  activeListings: 0,
  properties: 0,
  activeTenancies: 0,
  pendingApplications: 0,
  openReports: 0,
};

async function loadCounts(): Promise<Counts> {
  const db = serverDb();
  // count() aggregations in parallel — each is a single round-trip that
  // returns just the integer, no doc bodies. Cheap.
  //
  // Tenants / landlords are counted on the `role` field ('tenant' |
  // 'owner') — written by the Flutter signup flow on every account, so
  // it's the reliable discriminator. "Landlords of all types" = every
  // owner, B2C and B2B alike (ownerType only splits them further).
  //
  // Marketplace / contracts / moderation counters reuse the same statuses
  // the rest of the panel writes:
  //   - listings.status: 'active' | 'paused' | 'archived' — 'active' = live
  //     on the marketplace (kept in sync by the syncListing* Cloud Functions).
  //   - contracts.status: 'active' (live tenancy) | 'pending' (application
  //     awaiting the landlord) | 'cancelled'.
  //   - reports.status: 'open' (unactioned moderation queue) | 'reviewing' |
  //     'resolved' | 'dismissed'.
  const [
    pendingB2bSnap,
    managedSnap,
    suspendedSnap,
    tenantsSnap,
    landlordsSnap,
    activeListingsSnap,
    propertiesSnap,
    activeTenanciesSnap,
    pendingApplicationsSnap,
    openReportsSnap,
  ] = await Promise.all([
    db
      .collection('b2bOwnerRequests')
      .where('status', '==', 'pending')
      .count()
      .get(),
    db.collection('users').where('managedBy', '!=', null).count().get(),
    db
      .collection('users')
      .where('suspended.active', '==', true)
      .count()
      .get(),
    db.collection('users').where('role', '==', 'tenant').count().get(),
    db.collection('users').where('role', '==', 'owner').count().get(),
    db.collection('listings').where('status', '==', 'active').count().get(),
    db.collection('properties').count().get(),
    db.collection('contracts').where('status', '==', 'active').count().get(),
    db.collection('contracts').where('status', '==', 'pending').count().get(),
    db.collection('reports').where('status', '==', 'open').count().get(),
  ]);
  return {
    pendingB2b: pendingB2bSnap.data().count,
    managed: managedSnap.data().count,
    suspended: suspendedSnap.data().count,
    tenants: tenantsSnap.data().count,
    landlords: landlordsSnap.data().count,
    activeListings: activeListingsSnap.data().count,
    properties: propertiesSnap.data().count,
    activeTenancies: activeTenanciesSnap.data().count,
    pendingApplications: pendingApplicationsSnap.data().count,
    openReports: openReportsSnap.data().count,
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function DashboardPage() {
  const t = await getT();

  // Best-effort: if counts or activity fail (e.g. fresh deploy with no
  // collections yet), surface a neutral state rather than blowing up the
  // page.
  const [countsResult, activityResult] = await Promise.allSettled([
    loadCounts(),
    getRecentAdminActions(20),
  ]);
  const counts =
    countsResult.status === 'fulfilled' ? countsResult.value : EMPTY_COUNTS;
  const activity: AdminActionEntry[] =
    activityResult.status === 'fulfilled' ? activityResult.value : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={t('dashboard.statTotalTenants')}
          value={counts.tenants}
          href="/users?role=tenant"
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statTotalLandlords')}
          value={counts.landlords}
          href="/users?role=landlord"
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statActiveListings')}
          value={counts.activeListings}
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statTotalProperties')}
          value={counts.properties}
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statActiveTenancies')}
          value={counts.activeTenancies}
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statPendingApplications')}
          value={counts.pendingApplications}
          tone={counts.pendingApplications > 0 ? 'attention' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.statOpenReports')}
          value={counts.openReports}
          href="/moderation?filter=open"
          tone={counts.openReports > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.statPendingB2b')}
          value={counts.pendingB2b}
          href="/supervision"
          tone={counts.pendingB2b > 0 ? 'attention' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.statManagedAccounts')}
          value={counts.managed}
          href="/managed?filter=active"
          tone="neutral"
        />
        <StatCard
          label={t('dashboard.statSuspendedAccounts')}
          value={counts.suspended}
          href="/managed?filter=suspended"
          tone={counts.suspended > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t('dashboard.recentActivity')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {activity.length === 1
              ? t('dashboard.lastAction')
              : t('dashboard.lastActions', { count: activity.length })}
          </span>
        </div>

        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('dashboard.emptyActivity')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  // Some counters (marketplace / contracts metrics) have no dedicated admin
  // page to drill into yet — those render as a plain, non-clickable card.
  href?: string;
  tone: 'neutral' | 'attention' | 'warning';
}) {
  const ring =
    tone === 'attention'
      ? 'ring-1 ring-primary/30 bg-primary/5'
      : tone === 'warning'
        ? 'ring-1 ring-amber-500/30 bg-amber-500/5'
        : 'ring-1 ring-transparent';
  const base = `block rounded-lg border border-border bg-surface p-5 ${ring}`;
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </>
  );

  if (!href) {
    return <div className={base}>{body}</div>;
  }
  return (
    <Link href={href} className={`${base} transition-colors hover:bg-secondary/30`}>
      {body}
    </Link>
  );
}

function ActivityRow({ entry, t }: { entry: AdminActionEntry; t: TFunc }) {
  const formatted = formatAdminAction(entry, t);
  const toneClass = {
    neutral: 'bg-secondary text-muted-foreground',
    positive: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-700',
    destructive: 'bg-destructive/10 text-destructive',
  }[formatted.tone];

  return (
    <li className="flex items-start gap-3 py-3 text-sm">
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}
      >
        {entry.action.replace(/_/g, ' ')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{formatted.title}</p>
        {formatted.detail && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatted.detail}
          </p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          admin {entry.adminUid.slice(0, 8)}… · target {entry.targetUid.slice(0, 8)}…
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {entry.at ? dateFormatter.format(entry.at) : '—'}
      </span>
    </li>
  );
}
