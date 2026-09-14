// /partner-imports — upload a partner's spreadsheet and review what it holds.
//
// The point of this screen is the step between reading a file and trusting it.
// Every sheet we have been sent contains something a machine should not decide
// alone: a website link pointing at a different building, an availability note
// that could mean booked or offered, an address with the street type missing.
// So nothing is written until somebody has looked at the rows.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import { UploadForm } from './_components/upload-form';

interface ApiImport {
  id: string;
  owner: { id: string; email: string };
  profile: { id: string; name: string } | null;
  fileName: string;
  fileSize: number;
  status: string;
  counts: Record<string, number> | null;
  committedAt: string | null;
  createdAt: string;
}

interface ApiOwner {
  id: string;
  email: string;
  companyName: string | null;
  fullName: string | null;
}

interface ApiProfile {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  importCount: number;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

async function loadImports(): Promise<ApiImport[]> {
  const res = await apiAuthed<{ items: ApiImport[] }>('/admin/partner-imports?limit=25');
  return res?.items ?? [];
}

/** Landlord accounts an import can be loaded into. */
async function loadOwners(): Promise<ApiOwner[]> {
  const res = await apiAuthed<{ items: ApiOwner[] }>('/admin/users?role=owner&limit=100');
  return res?.items ?? [];
}

async function loadProfiles(): Promise<ApiProfile[]> {
  const res = await apiAuthed<{ items: ApiProfile[] }>('/admin/partner-imports/profiles/list');
  return res?.items ?? [];
}

export default async function PartnerImportsPage() {
  await requireAdminSession();
  const [t, imports, owners, profiles] = await Promise.all([
    getT(),
    loadImports(),
    loadOwners(),
    loadProfiles(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('partnerImports.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {t('partnerImports.subtitle')}
        </p>
      </header>

      <UploadForm
        owners={owners.map((o) => ({
          id: o.id,
          label: [o.companyName ?? o.fullName, o.email].filter(Boolean).join(' · '),
        }))}
        profiles={profiles.map((p) => ({ id: p.id, ownerId: p.ownerId, name: p.name }))}
      />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('partnerImports.historyTitle')}
        </h2>
        {imports.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            {t('partnerImports.historyEmpty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {imports.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/partner-imports/${row.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.fileName}
                      <StatusChip status={row.status} t={t} />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.owner.email}
                      {row.profile ? ` · ${row.profile.name}` : ''}
                      {row.counts
                        ? ` · ${row.counts.propertiesCreated ?? 0}+${row.counts.propertiesUpdated ?? 0} properties, ${row.counts.roomsCreated ?? 0}+${row.counts.roomsUpdated ?? 0} rooms`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(row.committedAt ?? row.createdAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusChip({ status, t }: { status: string; t: TFunc }) {
  const map: Record<string, { key: string; cls: string }> = {
    preview: { key: 'partnerImports.statusPreview', cls: 'bg-amber-500/10 text-amber-700' },
    committed: { key: 'partnerImports.statusCommitted', cls: 'bg-primary/10 text-primary' },
    discarded: { key: 'partnerImports.statusDiscarded', cls: 'bg-secondary text-muted-foreground' },
    failed: { key: 'partnerImports.statusFailed', cls: 'bg-destructive/10 text-destructive' },
  };
  const chip = map[status] ?? map.failed;
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${chip.cls}`}
    >
      {t(chip.key)}
    </span>
  );
}
