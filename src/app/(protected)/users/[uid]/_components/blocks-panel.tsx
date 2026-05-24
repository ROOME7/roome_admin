// Per-user blocks panel — surfaces both directions of the mutual block
// relationship for a single account. Doc reference:
// docs/architecture/app-store-rejection-2026-05-24.md §"Admin moderation
// panel" → `/moderation/blocks`.
//
// Layout: two columns, "blocked by this user" on the left and "users who
// blocked this user" on the right. Each row is a tiny chip with the
// counterparty's display name (resolved lazily) + a link into the admin
// user detail page. Empty arrays render an em-dash so the section is still
// visible — a user with zero blocks is also a useful signal.

import 'server-only';
import Link from 'next/link';
import { serverDb } from '@/lib/firebase-admin';
import type { TFunc } from '@/i18n/t';

interface PartyRow {
  uid: string;
  displayName: string;
}

async function resolveDisplayNames(uids: string[]): Promise<PartyRow[]> {
  if (uids.length === 0) return [];
  const db = serverDb();
  // Firestore `in` query caps at 10 — chunk to stay under it. Most users
  // will have a handful of blocks; pagination past that is a non-goal.
  const rows: PartyRow[] = [];
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    const snap = await db
      .collection('userProfiles')
      .where('__name__', 'in', chunk)
      .get();
    const byId = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of snap.docs) byId.set(doc.id, doc.data());
    for (const uid of chunk) {
      const data = byId.get(uid);
      const name =
        (typeof data?.displayUsername === 'string' && data.displayUsername) ||
        (typeof data?.username === 'string' && data.username) ||
        (typeof data?.name === 'string' && data.name) ||
        uid;
      rows.push({ uid, displayName: name });
    }
  }
  return rows;
}

export async function BlocksPanel({
  blocked,
  blockedBy,
  t,
}: {
  blocked: string[];
  blockedBy: string[];
  t: TFunc;
}) {
  const [blockedRows, blockedByRows] = await Promise.all([
    resolveDisplayNames(blocked),
    resolveDisplayNames(blockedBy),
  ]);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {t('users.blocksPanelTitle')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('users.blocksPanelSubtitle')}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Column
          title={t('users.blocksOutgoing')}
          empty={t('users.blocksOutgoingEmpty')}
          rows={blockedRows}
        />
        <Column
          title={t('users.blocksIncoming')}
          empty={t('users.blocksIncomingEmpty')}
          rows={blockedByRows}
        />
      </div>
    </section>
  );
}

function Column({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: PartyRow[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.uid}>
              <Link
                href={`/users/${row.uid}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <span className="truncate">{row.displayName}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {row.uid.slice(0, 6)}…
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
