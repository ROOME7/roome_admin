// /admins — who can sign in to this panel, and the history of that changing.
//
// ⚠️ READ-ONLY, AND THAT IS THE DESIGN. This page used to grant and revoke the
// role itself, by writing a Firebase custom claim. The new API has no endpoint
// for it and will not get one: `role = ADMIN` is unreachable from the request
// path on purpose, because an API that can promote its own caller will
// eventually promote a stranger's. Granting happens in a shell on the box, by
// someone who already holds the database credentials — see
// src/scripts/grant-admin.ts in the backend.
//
// What this page does instead is answer the two questions the buttons were
// there to serve: who has the role right now, and who changed that.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

/** The three actions the grant-admin script writes. */
const ROLE_ACTIONS = 'user.grant_admin,user.revoke_admin,user.create_admin';

interface ApiAdmin {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

interface ApiAuditRow {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; email: string | null; username: string } | null;
  target: { id: string; email: string | null; username: string } | null;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function fmtAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}

async function loadAdmins(): Promise<ApiAdmin[]> {
  // The whole admin team fits in one page by a wide margin; if it ever does
  // not, that is a different screen, not a bigger limit.
  const res = await apiAuthed<{ items: ApiAdmin[] }>('/admin/users?role=admin&limit=100');
  return res?.items ?? [];
}

async function loadRoleChanges(): Promise<ApiAuditRow[]> {
  const res = await apiAuthed<{ items: ApiAuditRow[] }>(
    `/admin/audit?action=${encodeURIComponent(ROLE_ACTIONS)}&limit=25`,
  );
  return res?.items ?? [];
}

export default async function AdminsPage() {
  const session = await requireAdminSession();
  const [t, admins, roleChanges] = await Promise.all([
    getT(),
    loadAdmins(),
    loadRoleChanges(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('admins.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {t('admins.subtitle')}
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('admins.currentAdmins', { count: admins.length })}
        </h2>
        <ul className="mt-3 space-y-2">
          {admins.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
              {t('admins.noAdmins')}
            </li>
          )}
          {admins.map((a) => {
            const isSelf = a.id === session.uid;
            return (
              <li key={a.id}>
                <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {a.email || t('admins.noEmail')}
                      {isSelf && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('admins.you')}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.fullName ?? `@${a.username}`}
                      <span> {t('admins.joinedOn', { date: fmtAt(a.createdAt) })}</span>
                      {a.lastSeenAt && (
                        <span> {t('admins.lastSeen', { date: fmtAt(a.lastSeenAt) })}</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {a.id}
                    </p>
                  </div>
                  <Link
                    href={`/users/${a.id}`}
                    className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    {t('common.view')}
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <HowToGrant t={t} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('admins.recentRoleChanges', { count: roleChanges.length })}
        </h2>
        <ul className="mt-3 space-y-2">
          {roleChanges.length === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
              {t('admins.noRoleChanges')}
            </li>
          )}
          {roleChanges.map((r) => (
            <RoleChangeRow key={r.id} row={r} t={t} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function HowToGrant({ t }: { t: TFunc }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{t('admins.howToTitle')}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {t('admins.howToBody')}
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('admins.howToStep')}
      </p>
      <pre className="mt-1.5 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-foreground">
        sudo docker compose run --rm app npm run admin:grant -- someone@roomeapp.it
      </pre>
      <p className="mt-2 text-xs text-muted-foreground">{t('admins.howToNote')}</p>
    </section>
  );
}

function RoleChangeRow({ row, t }: { row: ApiAuditRow; t: TFunc }) {
  const kind = row.action.endsWith('revoke_admin')
    ? 'revoke'
    : row.action.endsWith('create_admin')
      ? 'create'
      : 'grant';
  const label =
    kind === 'revoke'
      ? t('admins.actionRevoke')
      : kind === 'create'
        ? t('admins.actionCreate')
        : t('admins.actionGrant');

  // The script attributes a grant to the account that received it, because a
  // shell has no signed-in admin — so actor and target are the same person
  // there, and saying "by themselves" would be misleading.
  const bySelf = row.actor?.id === row.target?.id;

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm">
      <div className="min-w-0">
        <p className="truncate text-foreground">
          <span
            className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              kind === 'revoke'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {label}
          </span>
          {row.target?.email || row.target?.username || row.target?.id || '—'}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {bySelf
            ? t('admins.bySystem')
            : t('admins.by', {
                who: row.actor?.email || row.actor?.username || row.actor?.id || '—',
              })}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{fmtAt(row.createdAt)}</span>
    </li>
  );
}
