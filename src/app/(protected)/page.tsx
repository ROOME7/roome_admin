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

async function loadCounts(): Promise<{
  pendingB2b: number;
  managed: number;
  suspended: number;
  tenants: number;
  landlords: number;
}> {
  const db = serverDb();
  // count() aggregations in parallel — each is a single round-trip that
  // returns just the integer, no doc bodies. Cheap.
  //
  // Tenants / landlords are counted on the `role` field ('tenant' |
  // 'owner') — written by the Flutter signup flow on every account, so
  // it's the reliable discriminator. "Landlords of all types" = every
  // owner, B2C and B2B alike (ownerType only splits them further).
  const [
    pendingB2bSnap,
    managedSnap,
    suspendedSnap,
    tenantsSnap,
    landlordsSnap,
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
  ]);
  return {
    pendingB2b: pendingB2bSnap.data().count,
    managed: managedSnap.data().count,
    suspended: suspendedSnap.data().count,
    tenants: tenantsSnap.data().count,
    landlords: landlordsSnap.data().count,
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function DashboardPage() {
  // Best-effort: if counts or activity fail (e.g. fresh deploy with no
  // collections yet), surface a neutral state rather than blowing up the
  // page.
  const [countsResult, activityResult] = await Promise.allSettled([
    loadCounts(),
    getRecentAdminActions(20),
  ]);
  const counts =
    countsResult.status === 'fulfilled'
      ? countsResult.value
      : { pendingB2b: 0, managed: 0, suspended: 0, tenants: 0, landlords: 0 };
  const activity: AdminActionEntry[] =
    activityResult.status === 'fulfilled' ? activityResult.value : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          At-a-glance view of B2B approvals and managed-account activity.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total tenants"
          value={counts.tenants}
          href="/users?role=tenant"
          tone="neutral"
        />
        <StatCard
          label="Total landlords"
          value={counts.landlords}
          href="/users?role=landlord"
          tone="neutral"
        />
        <StatCard
          label="Pending B2B requests"
          value={counts.pendingB2b}
          href="/supervision"
          tone={counts.pendingB2b > 0 ? 'attention' : 'neutral'}
        />
        <StatCard
          label="Managed accounts"
          value={counts.managed}
          href="/managed?filter=active"
          tone="neutral"
        />
        <StatCard
          label="Suspended accounts"
          value={counts.suspended}
          href="/managed?filter=suspended"
          tone={counts.suspended > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Recent activity
          </h2>
          <span className="text-xs text-muted-foreground">
            Last {activity.length} admin action{activity.length === 1 ? '' : 's'}
          </span>
        </div>

        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing yet — admin actions (suspend, archive, refund, notify, role
            changes, on-behalf ops) will appear here as they happen.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
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
  href: string;
  tone: 'neutral' | 'attention' | 'warning';
}) {
  const ring =
    tone === 'attention'
      ? 'ring-1 ring-primary/30 bg-primary/5'
      : tone === 'warning'
        ? 'ring-1 ring-amber-500/30 bg-amber-500/5'
        : 'ring-1 ring-transparent';
  return (
    <Link
      href={href}
      className={`block rounded-lg border border-border bg-surface p-5 transition-colors hover:bg-secondary/30 ${ring}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </Link>
  );
}

function ActivityRow({ entry }: { entry: AdminActionEntry }) {
  const formatted = formatAdminAction(entry);
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
