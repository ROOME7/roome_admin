'use client';

// Take-over / Resolve / Dismiss buttons + their confirmation dialogs.
// Mirrors the pattern in supervision/_components/request-actions.tsx —
// reportId is bound server-side so the client can't tamper with which
// report is being mutated. Buttons are filtered by the current status:
//   open       → [Take over, Resolve, Dismiss]
//   reviewing  → [Resolve, Dismiss]
//   resolved   → (no actions)
//   dismissed  → (no actions)

import { useState, useTransition, type ReactNode } from 'react';
import {
  markReportReviewing as takeOverAction,
  resolveReport as resolveAction,
  dismissReport as dismissAction,
} from '../actions';
import { useT } from '@/i18n/client';
import type { ReportStatus } from '../_lib/types';

type ActionResult = { ok: true } | { ok: false; error: string };

type Mode = 'reviewing' | 'resolved' | 'dismissed';

interface ReportActionsProps {
  reportId: string;
  status: ReportStatus;
  /** Layout-only — detail page uses 'wrap', list card uses 'inline'. */
  layout?: 'inline' | 'wrap';
}

export function ReportActions({
  reportId,
  status,
  layout = 'inline',
}: ReportActionsProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode | null>(null);

  if (status === 'resolved' || status === 'dismissed') return null;

  return (
    <>
      <div className={layout === 'wrap' ? 'flex flex-wrap gap-2' : 'flex gap-2'}>
        {status === 'open' && (
          <button
            type="button"
            onClick={() => setMode('reviewing')}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {t('moderation.actionMarkReviewing')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode('dismissed')}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('moderation.actionDismiss')}
        </button>
        <button
          type="button"
          onClick={() => setMode('resolved')}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
        >
          {t('moderation.actionResolve')}
        </button>
      </div>

      {mode && (
        <ActionDialog
          mode={mode}
          reportId={reportId}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

interface DialogProps {
  mode: Mode;
  reportId: string;
  onClose: () => void;
}

function ActionDialog({ mode, reportId, onClose }: DialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const COPY: Record<
    Mode,
    {
      title: string;
      intro: string;
      submitLabel: string;
      submitClass: string;
      requiresNote: boolean;
    }
  > = {
    reviewing: {
      title: t('moderation.reviewingTitle'),
      intro: t('moderation.reviewingIntro'),
      submitLabel: t('moderation.actionMarkReviewing'),
      submitClass: 'bg-primary text-primary-foreground hover:bg-roome-blue-dark',
      requiresNote: false,
    },
    resolved: {
      title: t('moderation.resolveTitle'),
      intro: t('moderation.resolveIntro'),
      submitLabel: t('moderation.actionResolve'),
      submitClass: 'bg-primary text-primary-foreground hover:bg-roome-blue-dark',
      requiresNote: true,
    },
    dismissed: {
      title: t('moderation.dismissTitle'),
      intro: t('moderation.dismissIntro'),
      submitLabel: t('moderation.actionDismiss'),
      submitClass: 'bg-destructive text-destructive-foreground hover:opacity-90',
      requiresNote: false,
    },
  };
  const copy = COPY[mode];

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const fn =
        mode === 'reviewing'
          ? takeOverAction
          : mode === 'resolved'
            ? resolveAction
            : dismissAction;
      const result: ActionResult = await fn(reportId, formData);
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
        <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p>

        <label className="mt-4 block text-sm font-medium text-foreground">
          {t('moderation.actionTakenLabel')}
          <textarea
            name="actionTaken"
            maxLength={2000}
            disabled={pending}
            rows={3}
            required={copy.requiresNote}
            minLength={copy.requiresNote ? 3 : undefined}
            className="mt-1.5 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
            placeholder={t('moderation.actionTakenPlaceholder')}
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${copy.submitClass}`}
          >
            {pending ? t('moderation.working') : copy.submitLabel}
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
