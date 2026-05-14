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
import Link from 'next/link';
import type { Timestamp } from 'firebase-admin/firestore';
import { serverDb } from '@/lib/firebase-admin';
import { CreateManagedAccountButton } from './_components/create-managed-account';
import { HandoverButton } from './_components/handover-dialog';
import { OwnerTypeBadge, StatusBadge } from './_components/status-badge';
import { FilterTabs } from './_components/filter-tabs';
import { EditManagedAccountButton } from './_components/edit-managed-account';
import { NotesButton } from './_components/notes-dialog';
import { TagsButton } from './_components/tags-dialog';
import {
  ArchiveButton,
  ReactivateButton,
  ReclaimButton,
  SuspendButton,
} from './_components/lifecycle-dialogs';
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

function deriveStatus(
  data: FirebaseFirestore.DocumentData
): ManagedAccount['status'] {
  if (data.deletedAt) return 'archived';
  if (data.suspended && data.suspended.active === true) return 'suspended';
  if (data.managedBy) return 'active';
  return 'handed_over';
}

function mapDoc(uid: string, data: FirebaseFirestore.DocumentData): ManagedAccount {
  const suspended = (data.suspended ?? {}) as Record<string, unknown>;
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
    status: deriveStatus(data),
    adminNotes: typeof data.adminNotes === 'string' ? data.adminNotes : null,
    adminNotesUpdatedAt: tsToDate(data.adminNotesUpdatedAt),
    adminNotesUpdatedByUid:
      typeof data.adminNotesUpdatedByUid === 'string'
        ? data.adminNotesUpdatedByUid
        : null,
    adminTags: Array.isArray(data.adminTags)
      ? (data.adminTags as unknown[]).filter(
          (t): t is string => typeof t === 'string'
        )
      : [],
    suspendedActive: suspended.active === true,
    suspendedReason:
      typeof suspended.reason === 'string' ? (suspended.reason as string) : null,
    suspendedAt: tsToDate(suspended.suspendedAt),
    deletedAt: tsToDate(data.deletedAt),
    deletionReason:
      typeof data.deletionReason === 'string' ? data.deletionReason : null,
  };
}

async function loadAccounts(filter: FilterValue): Promise<{
  list: ManagedAccount[];
  counts: Record<FilterValue, number>;
}> {
  const db = serverDb();

  // Three reads, unioned by uid:
  //   1. currently-managed (managedBy != null) — includes suspended + active
  //   2. handed-over (managementHandedOverAt != null AND managedBy null)
  //   3. soft-deleted (deletedAt != null) — admin-archived accounts
  // For our scale, three reads is fine. Firestore can't AND-OR these into a
  // single query without compound indexes that aren't worth the upkeep.
  const [activeSnap, handedOverSnap, archivedSnap] = await Promise.all([
    db.collection('users').where('managedBy', '!=', null).get(),
    db.collection('users').where('managementHandedOverAt', '!=', null).get(),
    db.collection('users').where('deletedAt', '!=', null).get(),
  ]);

  const seen = new Set<string>();
  const list: ManagedAccount[] = [];
  const ingest = (
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    skipIf?: (d: FirebaseFirestore.DocumentData) => boolean
  ) => {
    if (seen.has(doc.id)) return;
    const data = doc.data();
    if (skipIf && skipIf(data)) return;
    seen.add(doc.id);
    list.push(mapDoc(doc.id, data));
  };

  for (const doc of activeSnap.docs) ingest(doc);
  for (const doc of handedOverSnap.docs) ingest(doc, (d) => Boolean(d.managedBy));
  for (const doc of archivedSnap.docs) ingest(doc);

  // Sort: active → suspended → handed_over → archived, within each by the
  // most-relevant timestamp desc.
  const order: Record<ManagedAccount['status'], number> = {
    active: 0,
    suspended: 1,
    handed_over: 2,
    archived: 3,
  };
  list.sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status];
    const ts = (x: ManagedAccount) =>
      (x.status === 'archived'
        ? x.deletedAt
        : x.status === 'suspended'
          ? x.suspendedAt
          : x.status === 'handed_over'
            ? x.managementHandedOverAt
            : x.managedAt)?.getTime() ?? 0;
    return ts(b) - ts(a);
  });

  const counts: Record<FilterValue, number> = {
    active: list.filter((x) => x.status === 'active').length,
    suspended: list.filter((x) => x.status === 'suspended').length,
    handed_over: list.filter((x) => x.status === 'handed_over').length,
    archived: list.filter((x) => x.status === 'archived').length,
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
    suspended: 'No accounts are currently suspended.',
    handed_over: 'No accounts have been handed over yet.',
    archived: 'No archived accounts on record.',
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">
              {displayHeader}
            </h2>
            <OwnerTypeBadge ownerType={account.ownerType} />
            {account.adminTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t}
              </span>
            ))}
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

      {account.status === 'suspended' && account.suspendedReason && (
        <p className="mt-4 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          <span className="font-medium">Suspension reason:</span> {account.suspendedReason}
        </p>
      )}
      {account.status === 'archived' && account.deletionReason && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="font-medium">Archive reason:</span> {account.deletionReason}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {/* Notes + Tags are available on every status (audit-friendly). */}
        <NotesButton account={account} />
        <TagsButton account={account} />

        {/* Status-specific actions: */}
        {account.status === 'active' && (
          <>
            <EditManagedAccountButton account={account} />
            <SuspendButton account={account} />
            <ArchiveButton account={account} />
            <OperateLink uid={account.uid} />
            <HandoverButton uid={account.uid} displayName={displayHeader} />
          </>
        )}
        {account.status === 'suspended' && (
          <>
            <ReactivateButton account={account} />
            <ArchiveButton account={account} />
          </>
        )}
        {account.status === 'handed_over' && (
          <ReclaimButton account={account} />
        )}
        {/* Archived: no actions; row is read-only. */}
      </footer>
    </article>
  );
}

function OperateLink({ uid }: { uid: string }) {
  // T3-A: on-behalf actions via server-action proxy. No impersonation
  // session; every write stamps _impersonatedByAdminUid directly on the
  // affected doc. See docs/architecture/admin-panel-roadmap.md §T3.
  return (
    <Link
      href={`/managed/${uid}/operate`}
      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
    >
      Operate
    </Link>
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
