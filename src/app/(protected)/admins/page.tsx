// /admins — list of platform admins + grant/revoke + audit log.
//
// Reads:
//   - Lists Firebase Auth users with the 'admin' role on customClaims.
//     The Auth SDK doesn't index by claim, so we paginate users and
//     filter client-side. For a small admin team this is fine; for >100
//     admins we'd want a denormalized index collection.
//   - Reads the most recent adminRoleChanges entries for the audit log.
//
// Mutations live in ../managed/actions.ts (grantAdminRoleByEmail,
// revokeAdminRole). They're co-located there because they share the
// recordAdminAction audit helper + the same auth/firebase-admin setup;
// only the surface UI lives here.

import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import { serverAuth, serverDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import { GrantAdminForm } from './_components/grant-admin-form';
import { RevokeAdminButton } from './_components/revoke-admin-button';

interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: Date | null;
}

interface RoleChange {
  id: string;
  action: 'grant' | 'revoke' | 'bootstrap' | string;
  targetUid: string;
  targetEmail: string | null;
  byUid: string | null;
  at: Date | null;
}

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

async function loadAdmins(): Promise<AdminUser[]> {
  const auth = serverAuth();
  const out: AdminUser[] = [];
  let pageToken: string | undefined;
  // Pagination caps at 1000 per page; the typical admin team is small but
  // we still loop in case there are many users in the project.
  // We bail after 10 pages (10k users) to avoid runaway scans.
  for (let i = 0; i < 10; i += 1) {
    const result = await auth.listUsers(1000, pageToken);
    for (const u of result.users) {
      const roles = Array.isArray(u.customClaims?.roles)
        ? (u.customClaims!.roles as unknown[])
        : [];
      if (roles.includes('admin')) {
        out.push({
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          createdAt: u.metadata.creationTime
            ? new Date(u.metadata.creationTime)
            : null,
        });
      }
    }
    if (!result.pageToken) break;
    pageToken = result.pageToken;
  }
  out.sort((a, b) =>
    (a.email ?? a.uid).localeCompare(b.email ?? b.uid)
  );
  return out;
}

async function loadRoleChanges(limit = 25): Promise<RoleChange[]> {
  const db = serverDb();
  // adminRoleChanges has no schema-enforced ordering field; existing
  // entries are written with `at: serverTimestamp`, so order by that desc.
  const snap = await db
    .collection('adminRoleChanges')
    .orderBy('at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: typeof data.action === 'string' ? data.action : 'unknown',
      targetUid: typeof data.targetUid === 'string' ? data.targetUid : '',
      targetEmail:
        typeof data.targetEmail === 'string' ? data.targetEmail : null,
      byUid: typeof data.byUid === 'string' ? data.byUid : null,
      at: tsToDate(data.at),
    };
  });
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function AdminsPage() {
  const adminSession = await requireAdminSession();

  const [admins, roleChanges] = await Promise.all([
    loadAdmins(),
    loadRoleChanges(),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Admins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team members with the <code className="rounded bg-muted px-1 py-0.5 text-xs">admin</code>{' '}
            custom claim. Grant by email; the target user must already have a
            Firebase Auth account.
          </p>
        </div>
        <GrantAdminForm />
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Current admins · {admins.length}
        </h2>
        <ul className="mt-3 space-y-2">
          {admins.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
              No admins on record. (You probably wouldn&apos;t be reading this if
              there were truly zero — your own admin status reads from the same
              claim. If this list is empty there may be a custom-claims sync
              issue.)
            </li>
          )}
          {admins.map((a) => {
            const isSelf = a.uid === adminSession.uid;
            return (
              <li key={a.uid}>
                <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {a.email ?? '(no email)'}
                      {isSelf && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          You
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.displayName ?? '—'}
                      {a.createdAt && (
                        <span> · joined {dateFormatter.format(a.createdAt)}</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {a.uid}
                    </p>
                  </div>
                  {!isSelf && (
                    <RevokeAdminButton
                      uid={a.uid}
                      email={a.email ?? a.uid}
                    />
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent role changes · {roleChanges.length}
        </h2>
        <ul className="mt-3 space-y-2">
          {roleChanges.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
              No grants or revokes recorded yet.
            </li>
          )}
          {roleChanges.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-foreground">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      r.action === 'grant'
                        ? 'bg-primary/10 text-primary'
                        : r.action === 'revoke'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.action}
                  </span>
                  {r.targetEmail ?? r.targetUid}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  by {r.byUid ?? '(system bootstrap)'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.at ? dateFormatter.format(r.at) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
