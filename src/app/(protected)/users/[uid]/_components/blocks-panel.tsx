// Per-user blocks panel — surfaces both directions of the mutual block
// relationship for a single account. Doc reference:
// docs/architecture/app-store-rejection-2026-05-24.md §"Admin moderation
// panel" → `/moderation/blocks`.
//
// ⚠️ NO LONGER FETCHES ANYTHING. It used to resolve each counterparty's
// display name from Firestore, ten ids at a time, which meant the number of
// round trips this section cost grew with how many people somebody had
// blocked. `GET /admin/users/{id}` returns the names with the ids, so this is
// now a pure render.
//
// Layout: two columns, "blocked by this user" on the left and "users who
// blocked this user" on the right. Empty arrays render a sentence rather than
// collapsing — a user with zero blocks is also a useful signal.

import Link from 'next/link';
import type { TFunc } from '@/i18n/t';
import type { ApiParty } from '../../_lib/user-model';

export function BlocksPanel({
  made,
  received,
  madeTotal,
  receivedTotal,
  t,
}: {
  made: ApiParty[];
  received: ApiParty[];
  /** The true totals. The lists themselves are capped by the API. */
  madeTotal: number;
  receivedTotal: number;
  t: TFunc;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{t('users.blocksPanelTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('users.blocksPanelSubtitle')}</p>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Column
          title={t('users.blocksOutgoing')}
          empty={t('users.blocksOutgoingEmpty')}
          rows={made}
          total={madeTotal}
          t={t}
        />
        <Column
          title={t('users.blocksIncoming')}
          empty={t('users.blocksIncomingEmpty')}
          rows={received}
          total={receivedTotal}
          t={t}
        />
      </div>
    </section>
  );
}

function Column({
  title,
  empty,
  rows,
  total,
  t,
}: {
  title: string;
  empty: string;
  rows: ApiParty[];
  total: number;
  t: TFunc;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {total > 0 && <span className="ml-1.5 font-mono normal-case">{total}</span>}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/users/${row.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="truncate">{row.fullName || row.username}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {row.id.slice(0, 6)}…
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Says so when the list is not the whole story, rather than letting
              a capped list read as a complete one. */}
          {total > rows.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('users.blocksTruncated', { shown: rows.length, total })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
