// Dashboard — at-a-glance counters, the property map, and the most recent
// admin decisions.
//
// All read-only, and all from the API: the counts in one transaction, the pins
// from the admin map endpoint, the feed from the append-only `admin_actions`
// table. That last one is new to this screen — the trail had been recording
// every privileged decision since the start with nothing able to display it.
//
// No caching layer on purpose: counters move slowly enough that a fresh read
// per page load is fine, and a stale figure here is worse than a 300ms wait.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import {
  formatAuditEntry,
  getRecentAuditEntries,
  type AuditEntry,
} from '@/lib/admin-audit';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import { DashboardMap, type MapMarker } from './_components/dashboard-map';

type Counts = {
  pendingB2b: number;
  /**
   * ⚠️ NULL, NOT ZERO. There is no managed-owner concept in Postgres yet — the
   * old panel's flag read a Firestore `managedBy` with no equivalent. Zero
   * would claim we looked and found none; null says the question cannot be
   * answered, and the card renders a dash.
   */
  managed: number | null;
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
  managed: null,
  suspended: 0,
  tenants: 0,
  landlords: 0,
  activeListings: 0,
  properties: 0,
  activeTenancies: 0,
  pendingApplications: 0,
  openReports: 0,
};

/**
 * ⚠️ THIS USED TO READ FIRESTORE, AND IT WAS REPORTING ON THE WRONG DATABASE.
 * It showed "540 active listings" while the app and the website served 15 —
 * the Firebase dataset the product migrated off. Every figure on the dashboard
 * described a system nobody uses, which is worse than showing nothing: a blank
 * card prompts a question, a confident wrong number does not.
 *
 * One call now, counted server-side in a single transaction so the figures are
 * a consistent snapshot rather than ten reads that can disagree.
 */
interface StatsResponse {
  totalTenants: number;
  totalLandlords: number;
  activeListings: number;
  totalProperties: number;
  activeTenancies: number;
  pendingApplications: number;
  openReports: number;
  pendingB2bRequests: number;
  suspendedAccounts: number;
  managedAccounts: number | null;
}

async function loadCounts(): Promise<Counts> {
  const s = await apiAuthed<StatsResponse>('/admin/stats');
  if (!s) return EMPTY_COUNTS;
  return {
    tenants: s.totalTenants,
    landlords: s.totalLandlords,
    activeListings: s.activeListings,
    properties: s.totalProperties,
    activeTenancies: s.activeTenancies,
    pendingApplications: s.pendingApplications,
    openReports: s.openReports,
    pendingB2b: s.pendingB2bRequests,
    suspended: s.suspendedAccounts,
    managed: s.managedAccounts,
  };
}

/**
 * One pin per PROPERTY, from the admin endpoint rather than the public
 * `/listings/map` — that one returns a pin per listed ROOM and carries no
 * address, so a three-room flat would stack three unlabelled pins on one spot
 * and an off-market property would vanish from an overview meant to show
 * everything, including what is not selling.
 */
async function loadMapMarkers(): Promise<MapMarker[]> {
  const res = await apiAuthed<{
    items: Array<{
      id: string;
      lat: number;
      lng: number;
      label: string;
      priceCents: number;
      onMarket: boolean;
    }>;
  }>('/admin/stats/map');

  return (res?.items ?? []).map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    kind: 'listing' as const,
    label: p.label,
    // Cents on the wire, euros on the screen — the conversion happens once,
    // here, rather than in each component.
    price: Math.round(p.priceCents / 100),
    onMarket: p.onMarket,
  }));
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
  const [countsResult, activityResult, markersResult] =
    await Promise.allSettled([
      loadCounts(),
      getRecentAuditEntries(20),
      loadMapMarkers(),
    ]);
  const counts =
    countsResult.status === 'fulfilled' ? countsResult.value : EMPTY_COUNTS;
  const activity: AuditEntry[] =
    activityResult.status === 'fulfilled' ? activityResult.value : [];
  const markers: MapMarker[] =
    markersResult.status === 'fulfilled' ? markersResult.value : [];

  return (
    <div className="space-y-6">
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

      <DashboardMap markers={markers} />

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
  // `null` means "not tracked", which is different from zero — see Counts.
  value: number | null;
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

function ActivityRow({ entry, t }: { entry: AuditEntry; t: TFunc }) {
  const formatted = formatAuditEntry(entry, t);
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
        {/* The raw action name, dots and all — it is what you would grep the
            audit table for. */}
        {entry.action}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{formatted.title}</p>
        {formatted.detail && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatted.detail}
          </p>
        )}
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {entry.actor?.email || entry.actor?.username || entry.actor?.id || '—'}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {entry.at ? dateFormatter.format(entry.at) : '—'}
      </span>
    </li>
  );
}
