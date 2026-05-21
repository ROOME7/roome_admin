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
import { useT } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

export function SuspendButton({ account }: { account: ManagedAccount }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10"
      >
        {t('managed.suspendButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.suspendDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.suspendDialogSubtitle', { name: heading })}
        </p>

        <div className="mt-5">
          <Field label={t('managed.waiverReasonLabel')} required hint={`${reason.length} / 1000`}>
            <textarea
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder={t('managed.suspendReasonPlaceholder')}
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || reason.trim().length < 3}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('managed.suspendSubmitting') : t('managed.suspendSubmit')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
      >
        {t('managed.reactivateButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.reactivateDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.reactivateDialogSubtitle', { name: heading })}
        </p>
        {account.suspendedReason && (
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground">
            <span className="font-medium">{t('managed.reactivateOriginalReason')}</span> {account.suspendedReason}
          </p>
        )}

        {result && (
          <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            {t('managed.reactivateSuccess', { count: result.listingsRestored })}
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || Boolean(result)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('managed.reactivateSubmitting') : t('managed.reactivateSubmit')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        {t('managed.archiveButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-destructive">{t('managed.archiveDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.archiveDialogSubtitle', { name: heading })}
        </p>

        {!result && (
          <div className="mt-5 space-y-4">
            <Field label={t('managed.waiverReasonLabel')} required hint={`${reason.length} / 1000`}>
              <textarea
                rows={4}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="input"
                placeholder={t('managed.archiveReasonPlaceholder')}
              />
            </Field>
            <Field
              label={t('managed.archiveConfirmLabel', { phrase: CONFIRM_PHRASE })}
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
              {t('managed.archiveSuccessListings', { count: result.listingsArchived })}
            </p>
            {result.subscriptionCancelled && (
              <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                {t('managed.archiveSuccessSubscription')}
              </p>
            )}
            {result.subscriptionCancelError && (
              <p className="rounded-md bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
                {t('managed.archiveSubscriptionCancelFailed', { error: result.subscriptionCancelError })}
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
            {result ? t('common.close') : t('common.cancel')}
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
              {pending ? t('managed.archiveSubmitting') : t('managed.archiveSubmit')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.reclaimButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.reclaimDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.reclaimDialogSubtitle', { name: heading })}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t('managed.reclaimBullet1')}</li>
          <li>{t('managed.reclaimBullet2')}</li>
          <li>{t('managed.reclaimBullet3')}</li>
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('managed.reclaimSubmitting') : t('managed.reclaimSubmit')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
