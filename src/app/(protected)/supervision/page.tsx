// /supervision — the B2B approval queue.
//
// Server Component. `GET /admin/b2b-requests` is the queue; the (protected)
// layout has verified the caller is an admin and the API checks the role
// again.
//
// ⚠️ THE DECISION USED TO BE WRITTEN IN FOUR PLACES. Approving a company meant
// updating the request document, mirroring `b2bApprovalStatus` onto the user,
// setting a Firebase custom claim, and hoping the three agreed — they did not,
// in production: twelve accounts carried the claim while four request records
// said approved. Approval is one row now, and everything that gates on "is
// this company approved?" joins to it.

import 'server-only';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import { RequestActions } from './_components/request-actions';
import {
  asFilter,
  mapApiRequest,
  type ApiB2bRequest,
  type B2bRequest,
  type FilterValue,
} from './_lib/types';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

async function loadRequests(filter: FilterValue): Promise<{
  list: B2bRequest[];
  counts: Record<FilterValue, number>;
}> {
  // The queue is oldest-first on the API — a review queue, not a feed — and
  // 100 is its ceiling. At a few applications a week that is years of backlog;
  // if it ever is not, the fix is paging, not a bigger number.
  const params = new URLSearchParams({ limit: '100' });
  if (filter !== 'all') params.set('status', filter);

  const res = await apiAuthed<{
    items: ApiB2bRequest[];
    counts: { pending: number; approved: number; rejected: number; all: number };
  }>(`/admin/b2b-requests?${params.toString()}`);

  const empty = { pending: 0, approved: 0, rejected: 0, all: 0 };
  if (!res) return { list: [], counts: empty };

  // `counts` arrived with a later deploy than the rest of this endpoint, and a
  // page that throws because one field is missing is a worse answer than a
  // page with zeroes in the tabs.
  return { list: res.items.map(mapApiRequest), counts: res.counts ?? empty };
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return dateFormatter.format(d);
}

type SearchParams = Promise<{ filter?: string }>;

export default async function SupervisionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const filter = asFilter(params.filter);
  const [t, { list, counts }] = await Promise.all([
    getT(),
    loadRequests(filter),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('supervision.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('supervision.subtitle')}
        </p>
      </header>

      <FilterTabs active={filter} counts={counts} t={t} />

      {list.length === 0 ? (
        <EmptyState filter={filter} t={t} />
      ) : (
        <ul className="space-y-4">
          {list.map((req) => (
            <li key={req.id}>
              <RequestCard request={req} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ filter, t }: { filter: FilterValue; t: TFunc }) {
  const messages: Record<FilterValue, string> = {
    pending: t('supervision.emptyPending'),
    approved: t('supervision.emptyApproved'),
    rejected: t('supervision.emptyRejected'),
    all: t('supervision.emptyAll'),
  };
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm text-muted-foreground">{messages[filter]}</p>
    </section>
  );
}

function RequestCard({ request, t }: { request: B2bRequest; t: TFunc }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">
            {request.companyName}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('supervision.submittedOn', { date: formatDate(request.submittedAt) })}
            {request.reviewedAt && (
              <>
                {' '}{t('supervision.reviewedOn', { date: formatDate(request.reviewedAt) })}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={request.status} t={t} />
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Field label="VAT (Partita IVA)" value={request.vatNumber || '—'} mono />
        <Field label="PEC" value={request.pec ?? '—'} />
        <Field label={t('supervision.fieldContact')} value={request.adminName ?? '—'} />
        <Field label={t('supervision.fieldPhone')} value={request.phoneNumber ?? '—'} />
        {/* The reference the applicant was given. It is what they quote to
            support, so it is what a reviewer should be able to search for. */}
        <Field label={t('supervision.fieldTicketRef')} value={request.ticketRef} mono />
        <Field label={t('supervision.fieldApplicant')} value={applicantLine(request)} />
      </dl>

      {request.notes && (
        <div className="mt-4 rounded-md border border-border bg-secondary p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {request.status === 'rejected' ? t('supervision.rejectionReason') : t('supervision.notes')}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{request.notes}</p>
        </div>
      )}

      {request.status === 'pending' && (
        <footer className="mt-5 flex justify-end border-t border-border pt-4">
          <RequestActions
            requestId={request.id}
            companyName={request.companyName}
          />
        </footer>
      )}
    </article>
  );
}

/** Who applied — a name and an email beat a uid nobody can act on. */
function applicantLine(r: B2bRequest): string {
  return [r.ownerName, r.ownerEmail].filter(Boolean).join(' · ') || r.ownerUid || '—';
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
        className={`mt-0.5 text-foreground ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
