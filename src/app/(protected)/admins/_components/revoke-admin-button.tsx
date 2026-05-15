'use client';

import { useState, useTransition } from 'react';
import { revokeAdminRole } from '../../managed/actions';

export function RevokeAdminButton({ uid, email }: { uid: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await revokeAdminRole(uid);
      if (!res.ok) {
        setError(res.error);
      } else {
        // The page revalidates the path on success; the row will drop out
        // on next render. No client-side optimistic removal needed.
        setConfirm(false);
      }
    });
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Revoke
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setConfirm(false);
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          title={`Revoke admin from ${email}`}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Revoking…' : 'Confirm revoke'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[10px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
