'use client';

// "Notes" button — admin scratchpad on a managed account. Allowed on
// handed-over and archived accounts too (notes survive across lifecycle).

import { useState, useTransition } from 'react';
import { setManagedAccountNote } from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { Field, InputStyles, Overlay } from './dialog-primitives';

const noteDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface Props {
  account: ManagedAccount;
}

export function NotesButton({ account }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Notes
        {account.adminNotes && account.adminNotes.length > 0 && (
          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </button>

      {open && <NotesDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function NotesDialog({ account, onClose }: { account: ManagedAccount; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(account.adminNotes ?? '');

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await setManagedAccountNote(account.uid, value);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Internal notes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Visible only to Roome admins. Survives handover and archival.
        </p>

        <div className="mt-5 space-y-3">
          <Field label="Note" hint={`${value.length} / 2000`}>
            <textarea
              rows={8}
              maxLength={2000}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="Anything worth recording…"
            />
          </Field>

          {account.adminNotesUpdatedAt && (
            <p className="text-xs text-muted-foreground">
              Last edited {noteDateFormatter.format(account.adminNotesUpdatedAt)}
              {account.adminNotesUpdatedByUid && (
                <span className="font-mono"> by {account.adminNotesUpdatedByUid.slice(0, 8)}…</span>
              )}
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
