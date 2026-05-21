'use client';

// Approve / Reject buttons + the confirmation dialog they open.
//
// The dialog itself is just a controlled <div> overlay; we deliberately
// don't use <dialog showModal()> because form submissions inside <dialog>
// have edge-case behavior across browsers and we want bullet-proof form
// submission as the security path.
//
// The form's `action` is the bound Server Action — the requestId is baked
// in server-side via .bind() in the parent (request-card), so the client
// CAN'T tamper with which doc it's mutating.

import { useState, useTransition, type ReactNode } from 'react';
import {
  approveB2bRequest as approveAction,
  rejectB2bRequest as rejectAction,
} from '../actions';
import { useT } from '@/i18n/client';

type ActionResult = { ok: true } | { ok: false; error: string };

type Mode = 'approve' | 'reject';

interface RequestActionsProps {
  requestId: string;
  companyName: string;
}

export function RequestActions({ requestId, companyName }: RequestActionsProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('reject')}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('supervision.rejectBtn')}
        </button>
        <button
          type="button"
          onClick={() => setMode('approve')}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
        >
          {t('supervision.approveBtn')}
        </button>
      </div>

      {mode && (
        <ActionDialog
          mode={mode}
          requestId={requestId}
          companyName={companyName}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

interface DialogProps {
  mode: Mode;
  requestId: string;
  companyName: string;
  onClose: () => void;
}

function ActionDialog({ mode, requestId, companyName, onClose }: DialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isApprove = mode === 'approve';
  const title = isApprove ? t('supervision.approveTitle') : t('supervision.rejectTitle');
  const intro = isApprove
    ? t('supervision.approveIntro', { companyName })
    : t('supervision.rejectIntro', { companyName });
  const submitLabel = isApprove ? t('supervision.approveBtn') : t('supervision.rejectBtn');
  const submitClass = isApprove
    ? 'bg-primary text-primary-foreground hover:bg-roome-blue-dark'
    : 'bg-destructive text-destructive-foreground hover:opacity-90';

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const fn = isApprove ? approveAction : rejectAction;
      const result: ActionResult = await fn(requestId, formData);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <form
        action={handleSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>

        <label className="mt-4 block text-sm font-medium text-foreground">
          {isApprove ? t('supervision.internalNote') : t('supervision.reasonForRejection')}
          <textarea
            name={isApprove ? 'notes' : 'reason'}
            required={!isApprove}
            minLength={!isApprove ? 3 : undefined}
            maxLength={2000}
            disabled={pending}
            rows={4}
            className="mt-1.5 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
            placeholder={
              isApprove
                ? t('supervision.notePlaceholder')
                : t('supervision.reasonPlaceholder')
            }
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${submitClass}`}
          >
            {pending ? t('supervision.working') : submitLabel}
          </button>
        </div>
      </form>
    </Overlay>
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
