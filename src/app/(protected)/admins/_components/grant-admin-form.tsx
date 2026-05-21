'use client';

import { useState, useTransition } from 'react';
import { grantAdminRoleByEmail } from '../../managed/actions';
import { useT } from '@/i18n/client';

export function GrantAdminForm() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function submit() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await grantAdminRoleByEmail(email);
      if (res.ok) {
        setOk(t('admins.grantSuccess', { email, uid: res.uid.slice(0, 8) }));
        setEmail('');
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
      >
        {t('admins.grantBtn')}
      </button>
    );
  }

  return (
    <div className="flex max-w-md flex-col items-stretch gap-2 rounded-lg border border-border bg-surface p-3">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('admins.grantLabel')}
      </label>
      <div className="flex gap-2">
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          placeholder={t('admins.grantPlaceholder')}
          className="flex-1 rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || email.trim().length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t('admins.granting') : t('admins.grant')}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setOk(null);
            setEmail('');
          }}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('common.cancel')}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          {ok}
        </p>
      )}
    </div>
  );
}
