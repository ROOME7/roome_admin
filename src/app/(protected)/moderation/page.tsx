// /moderation — UGC report queue (App Store guideline 1.2).
//
// Server Component. `GET /admin/reports` is the queue; (protected)/layout has
// already verified the caller is an admin, and the API checks again.
//
// ⚠️ THIS USED TO READ EVERY REPORT EVER FILED, unpaged, and count and filter
// them in memory. That works until the queue is big enough to matter, which is
// exactly when a moderation screen stops being optional. The API filters,
// counts and pages.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import { ReportActions } from './_components/report-actions';
import {
  asFilter,
  type ApiReport,
  type FilterValue,
  type Report,
} from './_lib/types';
import {
  formatDate,
  mapApiReport,
  reasonLabel,
  statusToApi,
  targetTypeLabel,
} from './_lib/format';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

const PAGE_SIZE = 50;

const EMPTY_COUNTS: Record<FilterValue, number> = {
  open: 0,
  reviewing: 0,
  resolved: 0,
  dismissed: 0,
  all: 0,
};

async function loadReports(
  filter: FilterValue,
  cursor: string,
): Promise<{
  list: Report[];
  counts: Record<FilterValue, number>;
  nextCursor: string | null;
}> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  // The API defaults to open + reviewing — the queue. Every other view has to
  // ask for its statuses by name, including "all".
  params.set(
    'status',
    filter === 'all'
      ? 'open,reviewing,actioned,dismissed'
      : filter === 'open'
        ? 'open'
        : statusToApi(filter),
  );
  if (cursor) params.set('cursor', cursor);

  const res = await apiAuthed<{
    items: ApiReport[];
    counts: { open: number; reviewing: number; actioned: number; dismissed: number; all: number };
    page: { cursor: string | null; hasMore: boolean };
  }>(`/admin/reports?${params.toString()}`);

  if (!res) return { list: [], counts: EMPTY_COUNTS, nextCursor: null };

  // `counts` arrived with a later deploy than the queue itself; zeroes in the
  // tabs beat a page that throws because one field is missing.
  const c = res.counts;
  return {
    list: res.items.map(mapApiReport),
    counts: c
      ? {
          open: c.open,
          reviewing: c.reviewing,
          // The tab is called "resolved" here and `actioned` on the wire.
          resolved: c.actioned,
          dismissed: c.dismissed,
          all: c.all,
        }
      : EMPTY_COUNTS,
    nextCursor: res.page.hasMore ? res.page.cursor : null,
  };
}

type SearchParams = Promise<{ filter?: string; cursor?: string }>;

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const filter = asFilter(params.filter);
  const cursor = typeof params.cursor === 'string' ? params.cursor : '';
  const [t, { list, counts, nextCursor }] = await Promise.all([
    getT(),
    loadReports(filter, cursor),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('moderation.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('moderation.subtitle')}
        </p>
      </header>

      <FilterTabs active={filter} counts={counts} t={t} />

      {list.length === 0 ? (
        <EmptyState filter={filter} t={t} />
      ) : (
        <>
          <ul className="space-y-4">
            {list.map((report) => (
              <li key={report.id}>
                <ReportRow report={report} t={t} />
              </li>
            ))}
          </ul>
          {/* A link, not a button: paging must survive a page reload, and the
              queue is a place people come back to. */}
          {nextCursor && (
            <div className="flex justify-center">
              <Link
                href={`/moderation?filter=${filter}&cursor=${encodeURIComponent(nextCursor)}`}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {t('common.loadMore')}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ filter, t }: { filter: FilterValue; t: TFunc }) {
  const messages: Record<FilterValue, string> = {
    open: t('moderation.emptyOpen'),
    reviewing: t('moderation.emptyReviewing'),
    resolved: t('moderation.emptyResolved'),
    dismissed: t('moderation.emptyDismissed'),
    all: t('moderation.emptyAll'),
  };
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm text-muted-foreground">{messages[filter]}</p>
    </section>
  );
}

// Compact list row. The full reported content + reporter/target mini-
// profiles live on /moderation/[reportId]; this row gives the admin
// just enough to triage and either click in or act inline.
function ReportRow({ report, t }: { report: Report; t: TFunc }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            <Link
              href={`/moderation/${report.id}`}
              className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-sm"
            >
              {targetTypeLabel(report.targetType, t)} · {reasonLabel(report.reason, t)}
            </Link>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('moderation.createdOn', { date: formatDate(report.createdAt) })}
            {report.resolvedAt && (
              <>
                {' '}
                {t('moderation.resolvedOn', { date: formatDate(report.resolvedAt) })}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={report.status} t={t} />
      </header>

      {report.note && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {report.note}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Link
          href={`/moderation/${report.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('moderation.actionViewDetail')} →
        </Link>
        <ReportActions reportId={report.id} status={report.status} />
      </footer>
    </article>
  );
}
