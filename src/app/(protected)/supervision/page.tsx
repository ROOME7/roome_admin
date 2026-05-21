// /supervision — B2B approval queue.
//
// Server Component. Reads `b2bOwnerRequests` via firebase-admin, which
// bypasses Firestore Rules. That's fine because (protected)/layout has
// already verified the caller is an admin (session cookie + 'admin'
// custom claim) before this server component runs.
//
// All state changes go through Server Actions in ./actions.ts which
// re-verify admin status on every call — see comments in that file for
// the full security model.

import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import { serverDb } from '@/lib/firebase-admin';
import { StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import { RequestActions } from './_components/request-actions';
import {
  asFilter,
  type B2bRequest,
  type B2bStatus,
  type FilterValue,
} from './_lib/types';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

const STATUS_ORDER_FOR_ALL: B2bStatus[] = ['pending', 'approved', 'rejected'];

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Admin SDK Timestamp has toDate(); also handle Firestore JSON-serialized form.
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function mapDoc(id: string, data: FirebaseFirestore.DocumentData): B2bRequest {
  return {
    id,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    companyName: typeof data.companyName === 'string' ? data.companyName : '(no company name)',
    vatNumber: typeof data.vatNumber === 'string' ? data.vatNumber : '',
    pec: typeof data.pec === 'string' && data.pec.length > 0 ? data.pec : null,
    phoneNumber:
      typeof data.phoneNumber === 'string' && data.phoneNumber.length > 0
        ? data.phoneNumber
        : null,
    status:
      data.status === 'approved' || data.status === 'rejected'
        ? data.status
        : 'pending',
    notes: typeof data.notes === 'string' && data.notes.length > 0 ? data.notes : null,
    submittedAt: timestampToDate(data.submittedAt),
    reviewedAt: timestampToDate(data.reviewedAt),
    reviewedByAdminUid:
      typeof data.reviewedByAdminUid === 'string' ? data.reviewedByAdminUid : null,
  };
}

async function loadRequests(filter: FilterValue): Promise<{
  list: B2bRequest[];
  counts: Record<FilterValue, number>;
}> {
  const db = serverDb();
  // Fetch everything once (the queue is small — generally <100). Cheaper
  // than three separate filtered queries when we also need per-status counts.
  // If this ever scales past a few thousand, switch to three indexed queries.
  const snap = await db
    .collection('b2bOwnerRequests')
    .orderBy('submittedAt', 'desc')
    .get();

  const all: B2bRequest[] = snap.docs.map((doc) => mapDoc(doc.id, doc.data()));

  const counts: Record<FilterValue, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    all: all.length,
  };
  for (const req of all) counts[req.status]++;

  const list =
    filter === 'all' ? all : all.filter((r) => r.status === filter);

  // For the "all" view, group by status to keep pending up top.
  if (filter === 'all') {
    list.sort((a, b) => {
      const ai = STATUS_ORDER_FOR_ALL.indexOf(a.status);
      const bi = STATUS_ORDER_FOR_ALL.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0);
    });
  }

  return { list, counts };
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
        <Field label={t('supervision.fieldPhone')} value={request.phoneNumber ?? '—'} />
        <Field label={t('supervision.fieldOwnerUid')} value={request.ownerUid || '—'} mono />
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
