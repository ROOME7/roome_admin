// /users — every user on the platform, of every type.
//
// Server Component, read-only. The (protected)/layout has already verified
// the caller is an admin. Reads the whole `users` collection (capped),
// classifies each doc, and renders a filterable list; each row links to
// /users/[uid] for the full detail view.
//
// No client components — filter tabs are <Link>s, search is a plain GET
// <form>. At launch scale (hundreds–low thousands of users) one capped
// read is fine; add cursor pagination if the collection grows large.

import 'server-only';
import Link from 'next/link';
import { serverDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import {
  asRoleFilter,
  mapUserRow,
  roleLabel,
  type RoleFilter,
  type UserRow,
} from './_lib/user-model';

const MAX_USERS = 2000;

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function matchesQuery(u: UserRow, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return (
    u.email.toLowerCase().includes(n) ||
    u.displayName.toLowerCase().includes(n) ||
    (u.fullName?.toLowerCase().includes(n) ?? false) ||
    (u.companyName?.toLowerCase().includes(n) ?? false) ||
    u.uid.toLowerCase().includes(n)
  );
}

async function loadUsers(
  role: RoleFilter,
  q: string
): Promise<{ list: UserRow[]; counts: Record<RoleFilter, number> }> {
  const db = serverDb();
  const snap = await db.collection('users').limit(MAX_USERS).get();
  const all = snap.docs.map((d) => mapUserRow(d.id, d.data()));

  // Counts are over the whole population (pre-search) so the tab badges
  // are stable while you type.
  const counts: Record<RoleFilter, number> = {
    all: all.length,
    tenant: all.filter((u) => u.kind === 'tenant').length,
    landlord: all.filter((u) => u.kind === 'landlord').length,
  };

  let list = all;
  if (role === 'tenant') list = list.filter((u) => u.kind === 'tenant');
  else if (role === 'landlord') {
    list = list.filter((u) => u.kind === 'landlord');
  }
  if (q) list = list.filter((u) => matchesQuery(u, q));

  // Newest accounts first; undated docs sink to the bottom.
  list.sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );
  return { list, counts };
}

type SearchParams = Promise<{ role?: string; q?: string }>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminSession();
  const t = await getT();
  const params = await searchParams;
  const role = asRoleFilter(params.role);
  const q = typeof params.q === 'string' ? params.q.trim() : '';

  const { list, counts } = await loadUsers(role, q);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('users.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('users.subtitle')}
        </p>
      </header>

      <FilterTabs active={role} counts={counts} q={q} t={t} />

      <form method="GET" className="flex gap-2">
        <input type="hidden" name="role" value={role} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t('users.searchPlaceholder')}
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('common.search')}
        </button>
        {q && (
          <Link
            href={`/users?role=${role}`}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('common.clear')}
          </Link>
        )}
      </form>

      {list.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q
              ? t('users.noSearchResults')
              : t('users.noUsersInCategory')}
          </p>
        </section>
      ) : (
        <ul className="space-y-2">
          {list.map((u) => (
            <li key={u.uid}>
              <UserRowCard user={u} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTabs({
  active,
  counts,
  q,
  t,
}: {
  active: RoleFilter;
  counts: Record<RoleFilter, number>;
  q: string;
  t: TFunc;
}) {
  const tabs: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: t('users.tabAll') },
    { value: 'tenant', label: t('users.tabTenants') },
    { value: 'landlord', label: t('users.tabLandlords') },
  ];
  const qs = q ? `&q=${encodeURIComponent(q)}` : '';
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`/users?role=${tab.value}${qs}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {counts[tab.value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
      {initial}
    </div>
  );
}

const STATUS_STYLES: Record<UserRow['status'], string> = {
  active: 'bg-primary/10 text-primary',
  suspended: 'bg-amber-500/10 text-amber-700',
  archived: 'bg-destructive/10 text-destructive',
};

const STATUS_KEYS: Record<UserRow['status'], string> = {
  active: 'common.statusActive',
  suspended: 'common.statusSuspended',
  archived: 'common.statusArchived',
};

function UserRowCard({ user, t }: { user: UserRow; t: TFunc }) {
  const headline = user.fullName || user.companyName || user.displayName;
  return (
    <Link
      href={`/users/${user.uid}`}
      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-secondary/30"
    >
      <Avatar url={user.photoUrl} name={headline} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {headline}
          </span>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {roleLabel(user.kind, user.ownerType, t)}
          </span>
          {user.managed && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {t('users.badgeManaged')}
            </span>
          )}
          {!user.emailVerified && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {t('users.badgeEmailUnverified')}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {user.email || t('users.noEmail')} · @{user.displayName.replace(/^@/, '')}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[user.status]}`}
        >
          {t(STATUS_KEYS[user.status])}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.createdAt ? dateFormatter.format(user.createdAt) : '—'}
        </p>
      </div>
    </Link>
  );
}
