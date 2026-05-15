'use client';

// "Activity" button on each managed-account row. Opens a dialog with the
// last 50 admin actions targeting that account, formatted via the shared
// audit-format helper so copy stays consistent with the dashboard feed.
//
// Loads on-demand (not pre-fetched on the page) — the row count is high
// enough that pre-fetching N activity feeds for the list would be wasteful.

import { useEffect, useState, useTransition } from 'react';
import { fetchAccountActivity } from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { Overlay } from './dialog-primitives';
import {
  formatAdminAction,
  type AdminActionEntry,
} from '@/lib/audit-format';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function ActivityButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Activity
      </button>
      {open && <ActivityDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function ActivityDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AdminActionEntry[] | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await fetchAccountActivity(account.uid, 50);
      if (res.ok) {
        setEntries(res.entries);
      } else {
        setError(res.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.uid]);

  const heading = account.companyName ?? account.displayUsername;

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Activity · {heading}
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">
            {account.uid.slice(0, 12)}…
          </span>
        </header>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 50 admin actions targeting this account. Same source as the
          dashboard recent-activity feed.
        </p>

        <div className="mt-5 max-h-[60vh] overflow-y-auto rounded-md border border-border">
          {pending && (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          )}
          {error && (
            <p
              role="alert"
              className="m-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {!pending && !error && entries && entries.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              No admin actions recorded for this account yet.
            </p>
          )}
          {!pending && entries && entries.length > 0 && (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <Row key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Row({ entry }: { entry: AdminActionEntry }) {
  const formatted = formatAdminAction(entry);
  const toneClass = {
    neutral: 'bg-secondary text-muted-foreground',
    positive: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-700',
    destructive: 'bg-destructive/10 text-destructive',
  }[formatted.tone];

  return (
    <li className="flex items-start gap-3 p-3 text-sm">
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}
      >
        {entry.action.replace(/_/g, ' ')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{formatted.title}</p>
        {formatted.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatted.detail}
          </p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          by {entry.adminUid.slice(0, 8)}…
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {entry.at ? dateFormatter.format(entry.at) : '—'}
      </span>
    </li>
  );
}
