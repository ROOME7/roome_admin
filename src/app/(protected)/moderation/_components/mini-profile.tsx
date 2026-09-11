// Compact "user mini-profile" card used by the report detail page.
//
// ⚠️ NO LONGER FETCHES. It used to read `users/{uid}` and `userProfiles/{uid}`
// per card, so the detail page cost four Firestore reads before it could
// render. `GET /admin/reports/{id}` embeds both parties, and an account that
// has since been erased arrives as null — which this renders as "unknown"
// rather than as a card with a uid and nothing else.

import Link from 'next/link';
import type { Party } from '../_lib/types';

export function MiniProfile({
  party,
  uid,
  label,
  fallback,
}: {
  party: Party | null;
  /** The id from the report, which survives the account it pointed at. */
  uid: string | null;
  label: string;
  /** Shown when there is nobody to show — e.g. "Reporter unknown". */
  fallback: string;
}) {
  if (!party && !uid) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{fallback}</p>
      </section>
    );
  }

  const id = party?.id ?? uid!;
  const displayName = party?.name || (party ? `@${party.username}` : id);

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {displayName.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {party?.name && (
            <p className="truncate text-xs text-muted-foreground">@{party.username}</p>
          )}
          {/* The account is gone but the report still names it — say which,
              rather than rendering a card that looks like a live user. */}
          {!party && (
            <p className="truncate text-xs text-muted-foreground">{fallback}</p>
          )}
          <p className="truncate font-mono text-[11px] text-muted-foreground">{id}</p>
        </div>
        <Link
          href={`/users/${id}`}
          className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          /users/{id.slice(0, 6)}…
        </Link>
      </div>
    </section>
  );
}
