// /managed — Active Management list.
//
// Server Component. Reads `users` where managedBy != null OR
// managementHandedOverAt != null via firebase-admin. The (protected)/layout
// has already verified the caller is admin before this runs.
//
// Two Firestore queries (one for currently-managed, one for handed-over)
// are unioned client-side — Firestore can't OR across two != filters in a
// single query without a compound index that requires sorting on those
// fields. For our scale, two reads is fine.
//
// All mutations live in ./actions.ts and re-verify the admin session.

import 'server-only';
import type { Timestamp } from 'firebase-admin/firestore';
import { serverDb } from '@/lib/firebase-admin';
import { CreateManagedAccountButton } from './_components/create-managed-account';
import { HandoverButton } from './_components/handover-dialog';
import { OwnerTypeBadge, StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import {
  asFilter,
  type FilterValue,
  type ManagedAccount,
  type OwnerType,
} from './_lib/types';

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

function deriveOwnerType(data: FirebaseFirestore.DocumentData): OwnerType {
  const roles = Array.isArray(data.roles) ? (data.roles as string[]) : [];
  if (roles.includes('owner_b2b')) return 'owner_b2b';
  return 'owner_b2c';
}

function mapDoc(uid: string, data: FirebaseFirestore.DocumentData): ManagedAccount {
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayUsername:
      typeof data.displayUsername === 'string'
        ? data.displayUsername
        : typeof data.username === 'string'
          ? data.username
          : '(unnamed)',
    fullName: typeof data.fullName === 'string' ? data.fullName : null,
    ownerType: deriveOwnerType(data),
    companyName: typeof data.companyName === 'string' ? data.companyName : null,
    vatNumber: typeof data.vatNumber === 'string' ? data.vatNumber : null,
    pec: typeof data.pec === 'string' && data.pec ? data.pec : null,
    phoneNumber:
      typeof data.phoneNumber === 'string' && data.phoneNumber
        ? data.phoneNumber
        : null,
    managedBy: typeof data.managedBy === 'string' ? data.managedBy : null,
    managedAt: tsToDate(data.managedAt),
    managementHandedOverAt: tsToDate(data.managementHandedOverAt),
    managementHandedOverByAdminUid:
      typeof data.managementHandedOverByAdminUid === 'string'
        ? data.managementHandedOverByAdminUid
        : null,
    status: data.managedBy ? 'active' : 'handed_over',
  };
}

async function loadAccounts(filter: FilterValue): Promise<{
  list: ManagedAccount[];
  counts: Record<FilterValue, number>;
}> {
  const db = serverDb();

  // Currently managed: managedBy is a real uid string (not null).
  // Firestore's '!=' against null works for our purposes.
  const activeSnap = await db
    .collection('users')
    .where('managedBy', '!=', null)
    .get();

  // Previously managed (handed-over) — managedBy is null AND
  // managementHandedOverAt is set. Firestore needs a compound query; we
  // use a single != filter and post-filter the data client-side, which is
  // fine because the volume is small.
  const handedOverSnap = await db
    .collection('users')
    .where('managementHandedOverAt', '!=', null)
    .get();

  const seen = new Set<string>();
  const list: ManagedAccount[] = [];

  for (const doc of activeSnap.docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    list.push(mapDoc(doc.id, doc.data()));
  }
  for (const doc of handedOverSnap.docs) {
    if (seen.has(doc.id)) continue;
    const data = doc.data();
    if (data.managedBy) continue; // still active, would have been in the first pass
    seen.add(doc.id);
    list.push(mapDoc(doc.id, data));
  }

  // Sort: active first (most-recent managedAt desc), then handed-over
  // (most-recent managementHandedOverAt desc).
  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    const at = (a.status === 'active' ? a.managedAt : a.managementHandedOverAt)?.getTime() ?? 0;
    const bt = (b.status === 'active' ? b.managedAt : b.managementHandedOverAt)?.getTime() ?? 0;
    return bt - at;
  });

  const counts: Record<FilterValue, number> = {
    active: list.filter((x) => x.status === 'active').length,
    handed_over: list.filter((x) => x.status === 'handed_over').length,
    all: list.length,
  };

  const filtered =
    filter === 'all' ? list : list.filter((x) => x.status === filter);

  return { list: filtered, counts };
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

export default async function ManagedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = asFilter(params.filter);
  const { list, counts } = await loadAccounts(filter);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Active Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts you operate on behalf of select partners. Create new ones,
            hand them back when the partner is ready to self-serve.
          </p>
        </div>
        <CreateManagedAccountButton />
      </header>

      <FilterTabs active={filter} counts={counts} />

      {list.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="space-y-4">
          {list.map((account) => (
            <li key={account.uid}>
              <AccountCard account={account} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterValue }) {
  const messages: Record<FilterValue, string> = {
    active: 'No managed accounts yet. Use "Create managed account" above to set one up.',
    handed_over: 'No accounts have been handed over yet.',
    all: 'No managed accounts on record yet.',
  };
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm text-muted-foreground">{messages[filter]}</p>
    </section>
  );
}

function AccountCard({ account }: { account: ManagedAccount }) {
  const displayHeader = account.companyName ?? account.displayUsername;
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">
              {displayHeader}
            </h2>
            <OwnerTypeBadge ownerType={account.ownerType} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {account.email || '(no email)'}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Field label="Display name" value={account.displayUsername} />
        {account.ownerType === 'owner_b2b' && (
          <Field label="VAT (Partita IVA)" value={account.vatNumber ?? '—'} mono />
        )}
        {account.ownerType === 'owner_b2b' && (
          <Field label="PEC" value={account.pec ?? '—'} />
        )}
        <Field label="Phone" value={account.phoneNumber ?? '—'} />
        <Field label="UID" value={account.uid} mono />
        {account.status === 'active' ? (
          <Field label="Managed since" value={formatDate(account.managedAt)} />
        ) : (
          <Field label="Handed over" value={formatDate(account.managementHandedOverAt)} />
        )}
      </dl>

      {account.status === 'active' && (
        <footer className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          <ManageAsPlaceholder />
          <HandoverButton uid={account.uid} displayName={displayHeader} />
        </footer>
      )}
    </article>
  );
}

function ManageAsPlaceholder() {
  // Real impersonation lands in a follow-up commit (two-Firebase-Auth-instances
  // pattern + custom-token minting + audit dashboard). Surface it as a
  // disabled button so the UI shape is honest.
  return (
    <button
      type="button"
      disabled
      title="Manage As coming next — see docs/architecture/admin-panel.md §4.3"
      className="cursor-not-allowed rounded-md border border-dashed border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted-foreground"
    >
      Manage As
      <span className="ml-1.5 inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Soon
      </span>
    </button>
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
        className={`mt-0.5 break-all text-foreground ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
