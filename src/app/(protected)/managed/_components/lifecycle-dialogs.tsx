'use client';

// T2 lifecycle actions on a managed account:
//   - Suspend: requires reason; disables Auth, pauses active listings
//   - Reactivate: re-enables Auth, restores admin-paused listings
//   - Archive: requires reason; soft-deletes account, archives listings;
//     UI reminds admin to cancel any Stripe subscription manually
//   - Reclaim: inverse of handover (only on handed-over accounts)
//
// Each surfaces as its own button; the AccountCard footer picks which
// buttons are visible based on `account.status`.

import { useState, useTransition } from 'react';
import {
  archiveManagedAccount,
  reactivateManagedAccount,
  reclaimManagedAccount,
  suspendManagedAccount,
} from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { Field, InputStyles, Overlay } from './dialog-primitives';

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

export function SuspendButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10"
      >
        Suspend
      </button>
      {open && <SuspendDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function SuspendDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await suspendManagedAccount(account.uid, reason);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const heading = account.companyName ?? account.displayUsername;

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Suspend account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>{heading}</strong> will be blocked from signing in, and every
          currently-public listing they own will be paused with reason{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">admin_suspended</code>.
          Reversible via Reactivate.
        </p>

        <div className="mt-5">
          <Field label="Reason" required hint={`${reason.length} / 1000`}>
            <textarea
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="Why are you suspending this account? Visible only to admins."
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            onClick={submit}
            disabled={pending || reason.trim().length < 3}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Suspending…' : 'Suspend'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Reactivate
// ---------------------------------------------------------------------------

export function ReactivateButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
      >
        Reactivate
      </button>
      {open && <ReactivateDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReactivateDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ listingsRestored: number } | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await reactivateManagedAccount(account.uid);
      if (res.ok) {
        setResult({ listingsRestored: res.listingsRestored });
        // Auto-close after a short pause so the admin can see the count.
        setTimeout(onClose, 1500);
      } else {
        setError(res.error);
      }
    });
  }

  const heading = account.companyName ?? account.displayUsername;

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Reactivate account?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>{heading}</strong> will be able to sign in again. Any listings
          paused by the original suspension will be restored to{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">active</code>.
        </p>
        {account.suspendedReason && (
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground">
            <span className="font-medium">Original reason:</span> {account.suspendedReason}
          </p>
        )}

        {result && (
          <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            Reactivated. {result.listingsRestored} listing(s) restored.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            onClick={submit}
            disabled={pending || Boolean(result)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Reactivating…' : 'Reactivate'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Archive (soft-delete)
// ---------------------------------------------------------------------------

export function ArchiveButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Archive
      </button>
      {open && <ArchiveDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function ArchiveDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<{
    listingsArchived: number;
    subscriptionCancelled: boolean;
    subscriptionCancelError: string | null;
  } | null>(null);

  const heading = account.companyName ?? account.displayUsername;
  const CONFIRM_PHRASE = 'archive';

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await archiveManagedAccount(account.uid, reason);
      if (res.ok) {
        setResult({
          listingsArchived: res.listingsArchived,
          subscriptionCancelled: res.subscriptionCancelled,
          subscriptionCancelError: res.subscriptionCancelError,
        });
        // No auto-close — admin needs to read the Stripe status.
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-destructive/30 bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-destructive">Archive account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Soft-deletes <strong>{heading}</strong>: disables sign-in, archives every
          listing they own, and stamps{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">deletedAt</code> on
          the user doc. Reads from the Flutter app will be blocked. This is not
          a hard delete — data is retained for audit / GDPR-right-to-be-forgotten.
        </p>

        {!result && (
          <div className="mt-5 space-y-4">
            <Field label="Reason" required hint={`${reason.length} / 1000`}>
              <textarea
                rows={4}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="Why are you archiving this account?"
              />
            </Field>
            <Field
              label={`Type "${CONFIRM_PHRASE}" to confirm`}
              required
            >
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={pending}
                autoComplete="off"
                className="input font-mono"
              />
            </Field>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              Archived. {result.listingsArchived} listing(s) marked archived.
            </p>
            {result.subscriptionCancelled && (
              <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                Stripe subscription cancelled automatically.
              </p>
            )}
            {result.subscriptionCancelError && (
              <p className="rounded-md bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
                <strong>Stripe subscription cancel failed:</strong>{' '}
                {result.subscriptionCancelError}. Cancel manually in the Stripe
                Dashboard.
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={
                pending ||
                reason.trim().length < 3 ||
                confirmText.trim().toLowerCase() !== CONFIRM_PHRASE
              }
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Archiving…' : 'Archive account'}
            </button>
          )}
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Reclaim (un-handover)
// ---------------------------------------------------------------------------

export function ReclaimButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Reclaim
      </button>
      {open && <ReclaimDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReclaimDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await reclaimManagedAccount(account.uid);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  const heading = account.companyName ?? account.displayUsername;

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Reclaim management?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll re-take operational control of <strong>{heading}</strong>.
          The partner can still sign in with their existing password, but the
          account will once again show as <em>Managed</em>.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>The €150/yr subscription waiver re-activates while managed.</li>
          <li>
            Any active Stripe subscription the partner currently has is{' '}
            <em>not</em> cancelled.
          </li>
          <li>B2B approval state is unchanged.</li>
        </ul>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Reclaiming…' : 'Reclaim'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
