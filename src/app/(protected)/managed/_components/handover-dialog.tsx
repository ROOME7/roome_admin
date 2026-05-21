'use client';

// Hand-over flow: confirm dialog → Server Action releases ownership → client
// sends a password-reset email using Firebase Auth's built-in template.
//
// The two legs are deliberately split:
//   1. Server Action (firebase-admin, server-side, audited): flips
//      managedBy=null, sets managementHandedOverAt + …ByAdminUid.
//   2. Client SDK (firebase web SDK, browser): triggers Firebase's
//      "Reset password" email template. This template is configured in
//      Firebase Console → Authentication → Templates and is only callable
//      from the client SDK; firebase-admin can only generate links, not
//      send branded emails.
//
// If step 2 fails after step 1 succeeded, the handover stands; we surface a
// clear "email failed — partner can use 'Forgot password' on the app/site"
// note. The state stays consistent because reset emails are best-effort
// for the lifecycle event we already committed.

import { useState, useTransition, type ReactNode } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { adminAuth } from '@/lib/firebase-client';
import { handoverManagedAccount } from '../actions';
import { useT } from '@/i18n/client';

type Outcome =
  | { kind: 'success' }
  | { kind: 'success_email_failed' }
  | { kind: 'error'; message: string };

export function HandoverButton({
  uid,
  displayName,
}: {
  uid: string;
  displayName: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.handoverButton')}
      </button>
      {open && (
        <HandoverDialog
          uid={uid}
          displayName={displayName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function HandoverDialog({
  uid,
  displayName,
  onClose,
}: {
  uid: string;
  displayName: string;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function confirm() {
    setOutcome(null);
    startTransition(async () => {
      const result = await handoverManagedAccount(uid);
      if (!result.ok) {
        setOutcome({ kind: 'error', message: result.error });
        return;
      }
      // Server side is done; now ask Firebase to email the partner.
      try {
        await sendPasswordResetEmail(adminAuth, result.email);
        setOutcome({ kind: 'success' });
      } catch (e) {
        console.error('[handover] password reset email failed:', e);
        setOutcome({ kind: 'success_email_failed' });
      }
    });
  }

  // After success, hold the dialog open with a confirmation message rather
  // than auto-closing, so the admin sees that the email was sent.
  const isDone = outcome?.kind === 'success' || outcome?.kind === 'success_email_failed';

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">
          {isDone
            ? t('managed.handoverDialogTitleDone')
            : t('managed.handoverDialogTitleConfirm', { name: displayName })}
        </h2>

        {!isDone && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('managed.handoverSubtitle')}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <Check />
                <span>
                  <strong className="font-medium">managedBy</strong>{' '}
                  {t('managed.handoverCheck1ManagedBy')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check />
                <span>
                  <code className="rounded bg-muted px-1 text-xs">
                    managementHandedOverAt
                  </code>{' '}
                  +{' '}
                  <code className="rounded bg-muted px-1 text-xs">
                    managementHandedOverByAdminUid
                  </code>{' '}
                  — {t('managed.handoverCheck2AuditTrail')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check />
                <span>{t('managed.handoverCheck3Email')}</span>
              </li>
            </ul>
          </>
        )}

        {outcome?.kind === 'error' && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {outcome.message}
          </p>
        )}

        {outcome?.kind === 'success' && (
          <div className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            {t('managed.handoverSuccessMessage')}
          </div>
        )}

        {outcome?.kind === 'success_email_failed' && (
          <div className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
            {t('managed.handoverEmailFailedMessage')}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {!isDone ? (
            <>
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
                onClick={confirm}
                disabled={pending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? t('managed.handoverConfirming') : t('managed.handoverConfirmButton')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
            >
              {t('managed.handoverDoneButton')}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-success"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="contents"
      >
        {children}
      </div>
    </div>
  );
}
