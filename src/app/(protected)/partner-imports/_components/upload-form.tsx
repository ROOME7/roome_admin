'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
import { previewImport } from '../actions';

export interface OwnerOption {
  id: string;
  label: string;
}
export interface ProfileOption {
  id: string;
  ownerId: string;
  name: string;
}

export function UploadForm({
  owners,
  profiles,
}: {
  owners: OwnerOption[];
  profiles: ProfileOption[];
}) {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');

  // A mapping belongs to a partner, so only that partner's are offered.
  const ownerProfiles = useMemo(
    () => profiles.filter((p) => p.ownerId === ownerId),
    [profiles, ownerId],
  );

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await previewImport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const id = (result.data as { id?: string } | undefined)?.id;
      if (id) router.push(`/partner-imports/${id}`);
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{t('partnerImports.uploadTitle')}</h2>

      <form ref={formRef} action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-foreground">{t('partnerImports.ownerLabel')}</span>
          <select
            name="ownerId"
            required
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="mt-1.5 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {owners.length === 0 && <option value="">—</option>}
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t('partnerImports.ownerHelp')}
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-foreground">{t('partnerImports.profileLabel')}</span>
          <select
            name="profileId"
            className="mt-1.5 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">{t('partnerImports.profileNone')}</option>
            {ownerProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{t('partnerImports.fileLabel')}</span>
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-1.5 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
        </label>

        {error && (
          <p role="alert" className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending || owners.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('partnerImports.uploading') : t('partnerImports.upload')}
          </button>
        </div>
      </form>
    </section>
  );
}
