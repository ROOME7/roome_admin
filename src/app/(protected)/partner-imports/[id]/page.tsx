// /partner-imports/[id] — what this file would do, before it does it.
//
// ⚠️ THIS SCREEN IS THE FEATURE. Reading a spreadsheet is the easy half; the
// hard half is that every sheet we have been sent contains something a machine
// should not decide alone — a link pointing at a different building, an
// availability note that could mean booked or could mean offered, an address
// with the street type missing. So the rows are shown with what was guessed,
// what would change and what cannot be published, and nothing is written until
// somebody presses the button.

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import { DecideButtons } from '../_components/decide-buttons';
import { MappingPanel } from '../_components/mapping-panel';
import { PlanTable } from '../_components/plan-table';
import type { ImportDetail } from '../_lib/types';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type Params = Promise<{ id: string }>;

export default async function ImportDetailPage({ params }: { params: Params }) {
  await requireAdminSession();
  const { id } = await params;
  const detail = await apiAuthed<ImportDetail>(`/admin/partner-imports/${encodeURIComponent(id)}`);
  if (!detail) notFound();
  const t = await getT();

  const summary = detail.plan?.summary;
  const decided = detail.status !== 'preview';

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/partner-imports" className="hover:underline">
          ← {t('partnerImports.title')}
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {detail.fileName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.owner.email} · {dateFormatter.format(new Date(detail.createdAt))}
            {detail.profile ? ` · ${detail.profile.name}` : ''}
          </p>
        </div>
        {!decided && <DecideButtons id={detail.id} />}
      </header>

      {decided && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-foreground">
            {detail.status === 'committed'
              ? t('partnerImports.committed', {
                  properties:
                    (detail.counts?.propertiesCreated ?? 0) + (detail.counts?.propertiesUpdated ?? 0),
                  rooms: (detail.counts?.roomsCreated ?? 0) + (detail.counts?.roomsUpdated ?? 0),
                })
              : t('partnerImports.statusDiscarded')}
          </p>
          {detail.status === 'committed' && (
            <p className="mt-1 text-muted-foreground">{t('partnerImports.committedNote')}</p>
          )}
        </section>
      )}

      {detail.alreadyCommittedAt && !decided && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          {t('partnerImports.alreadyCommitted', {
            date: dateFormatter.format(new Date(detail.alreadyCommittedAt)),
          })}
        </p>
      )}

      {summary && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            label={t('partnerImports.summaryProperties')}
            main={summary.propertiesCreated + summary.propertiesUpdated}
            lines={[
              t('partnerImports.summaryCreated', { count: summary.propertiesCreated }),
              t('partnerImports.summaryUpdated', { count: summary.propertiesUpdated }),
              t('partnerImports.summaryUnchanged', { count: summary.propertiesUnchanged }),
            ]}
          />
          <Stat
            label={t('partnerImports.summaryRooms')}
            main={summary.roomsCreated + summary.roomsUpdated}
            lines={[
              t('partnerImports.summaryCreated', { count: summary.roomsCreated }),
              t('partnerImports.summaryUpdated', { count: summary.roomsUpdated }),
              t('partnerImports.summaryUnchanged', { count: summary.roomsUnchanged }),
            ]}
          />
          <Stat
            label={t('partnerImports.summaryBlocked')
              .replace('{count} ', '')
              .replace(/^./, (c) => c.toUpperCase())}
            main={summary.roomsBlocked}
            tone={summary.roomsBlocked > 0 ? 'warning' : 'neutral'}
            lines={[t('partnerImports.summaryErrors', { count: summary.rowsWithErrors })]}
          />
          <Stat
            label={t('calendars.title')}
            main={summary.calendarFeeds}
            lines={[t('partnerImports.summaryFeeds', { count: summary.calendarFeeds })]}
          />
        </section>
      )}

      <Problems detail={detail} t={t} />

      {detail.mapping && (
        <MappingPanel
          importId={detail.id}
          ownerId={detail.owner.id}
          ownerEmail={detail.owner.email}
          headers={detail.headers ?? []}
          mapping={detail.mapping}
          headerHash={detail.headerHash ?? null}
          fields={detail.fields ?? []}
          readOnly={decided}
        />
      )}

      {detail.plan && <PlanTable plan={detail.plan} />}
    </div>
  );
}

function Problems({ detail, t }: { detail: ImportDetail; t: TFunc }) {
  const items = [
    ...(detail.plan?.fileIssues ?? []).map((m) => ({ level: 'warning' as const, message: m })),
    ...(detail.problems ?? []).map((p) => ({ level: 'warning' as const, message: p.message })),
    ...(detail.notes ?? []).map((n) => ({ level: n.level, message: n.message })),
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{t('partnerImports.problemsTitle')}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('partnerImports.noProblems')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span
                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.level === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground/50'
                }`}
                aria-hidden="true"
              />
              <span className={item.level === 'warning' ? 'text-foreground' : 'text-muted-foreground'}>
                {item.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  main,
  lines,
  tone = 'neutral',
}: {
  label: string;
  main: number;
  lines: string[];
  tone?: 'neutral' | 'warning';
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === 'warning' && main > 0
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border bg-surface'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{main}</p>
      {lines.map((line, i) => (
        <p key={i} className="mt-0.5 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
