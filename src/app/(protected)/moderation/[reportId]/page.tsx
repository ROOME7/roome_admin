// /moderation/[reportId] — single-report detail view.
//
// Surfaces the full report payload (no truncation), the reporter +
// reported-account mini-profiles with deep-links into /users/[uid], and
// the same action buttons that live on the list row. Doc reference:
// docs/architecture/app-store-rejection-2026-05-24.md §Issue 2(b).

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverDb } from '@/lib/firebase-admin';
import { getT } from '@/i18n/server';
import { StatusBadge } from '../_components/status-badge';
import { MiniProfile } from '../_components/mini-profile';
import { ReportActions } from '../_components/report-actions';
import {
  formatDate,
  mapReportDoc,
  reasonLabel,
  targetTypeLabel,
} from '../_lib/format';

type Params = Promise<{ reportId: string }>;

export default async function ReportDetailPage({ params }: { params: Params }) {
  const { reportId } = await params;
  const db = serverDb();
  const snap = await db.collection('reports').doc(reportId).get();
  if (!snap.exists) notFound();
  const t = await getT();
  const report = mapReportDoc(snap.id, snap.data() ?? {});

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/moderation" className="hover:underline">
          ← {t('moderation.title')}
        </Link>
      </nav>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {targetTypeLabel(report.targetType, t)} · {reasonLabel(report.reason, t)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <MiniProfile
          uid={report.reporterUid || null}
          label={t('moderation.detailReporter')}
          fallback={t('moderation.reporterUnknown')}
        />
        <MiniProfile
          uid={report.targetOwnerUid}
          label={t('moderation.detailTarget')}
          fallback={t('moderation.targetUnknown')}
        />
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('moderation.fieldNote')}
        </h2>
        {report.note ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            {report.note}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('moderation.fieldContext')}
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field
            label={t('moderation.fieldTargetType')}
            value={targetTypeLabel(report.targetType, t)}
          />
          <Field label={t('moderation.fieldReason')} value={reasonLabel(report.reason, t)} />
          <Field label={t('moderation.fieldTargetId')} value={report.targetId || '—'} mono />
          <Field
            label={t('moderation.fieldTargetOwnerUid')}
            value={report.targetOwnerUid ?? '—'}
            mono
          />
        </dl>
        {Object.keys(report.context).length > 0 && (
          <dl className="mt-4 space-y-1 rounded-md border border-border bg-secondary p-3">
            {Object.entries(report.context).map(([k, v]) => (
              <div key={k} className="flex flex-wrap gap-1">
                <dt className="text-xs font-medium text-muted-foreground">{k}:</dt>
                <dd className="break-all font-mono text-xs text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {report.actionTaken && (
        <section className="rounded-lg border border-border bg-secondary p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('moderation.actionTakenLabel')}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            {report.actionTaken}
          </p>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
        <ReportActions reportId={report.id} status={report.status} layout="wrap" />
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-foreground ${mono ? 'break-all font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
