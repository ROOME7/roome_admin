// /moderation — UGC report queue (App Store guideline 1.2).
//
// Server Component. Reads `reports/{reportId}` via firebase-admin, which
// bypasses Firestore Rules. (protected)/layout has already verified the
// caller is an admin before this page runs. Server Actions in ./actions.ts
// re-verify on every call.

import 'server-only';
import Link from 'next/link';
import { serverDb } from '@/lib/firebase-admin';
import { StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import { ReportActions } from './_components/report-actions';
import {
  asFilter,
  type FilterValue,
  type Report,
  type ReportStatus,
} from './_lib/types';
import {
  formatDate,
  mapReportDoc,
  reasonLabel,
  targetTypeLabel,
} from './_lib/format';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

const STATUS_ORDER_FOR_ALL: ReportStatus[] = [
  'open',
  'reviewing',
  'resolved',
  'dismissed',
];

async function loadReports(filter: FilterValue): Promise<{
  list: Report[];
  counts: Record<FilterValue, number>;
}> {
  const db = serverDb();
  const snap = await db
    .collection('reports')
    .orderBy('serverCreatedAt', 'desc')
    .get();

  const all: Report[] = snap.docs.map((doc) => mapReportDoc(doc.id, doc.data()));

  const counts: Record<FilterValue, number> = {
    open: 0,
    reviewing: 0,
    resolved: 0,
    dismissed: 0,
    all: all.length,
  };
  for (const r of all) counts[r.status]++;

  const list = filter === 'all' ? all : all.filter((r) => r.status === filter);

  if (filter === 'all') {
    list.sort((a, b) => {
      const ai = STATUS_ORDER_FOR_ALL.indexOf(a.status);
      const bi = STATUS_ORDER_FOR_ALL.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });
  }

  return { list, counts };
}

type SearchParams = Promise<{ filter?: string }>;

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = asFilter(params.filter);
  const [t, { list, counts }] = await Promise.all([
    getT(),
    loadReports(filter),
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
        <ul className="space-y-4">
          {list.map((report) => (
            <li key={report.id}>
              <ReportRow report={report} t={t} />
            </li>
          ))}
        </ul>
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
