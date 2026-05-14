'use client';

// Applications tab on the Operate page. Lists pending tenant applications
// awaiting the partner-landlord's response and lets the admin accept or
// decline each one as the partner.

import { useState, useTransition } from 'react';
import { respondToApplicationAs } from '../actions';
import type { OperateApplicationSummary } from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function ApplicationsTab({
  uid,
  applications,
  disabled,
}: {
  uid: string;
  applications: OperateApplicationSummary[];
  disabled: boolean;
}) {
  if (applications.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No pending applications for this partner.
        </p>
      </section>
    );
  }
  return (
    <ul className="space-y-3">
      {applications.map((a) => (
        <li key={a.contractId}>
          <ApplicationRow uid={uid} application={a} disabled={disabled} />
        </li>
      ))}
    </ul>
  );
}

function ApplicationRow({
  uid,
  application,
  disabled,
}: {
  uid: string;
  application: OperateApplicationSummary;
  disabled: boolean;
}) {
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  return (
    <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {application.tenantDisplayName}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applied {application.appliedAt ? dateFormatter.format(application.appliedAt) : '—'} · room{' '}
          <span className="font-mono">{application.roomId || '—'}</span>
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {application.contractId}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDecision('decline')}
          disabled={disabled}
          className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => setDecision('accept')}
          disabled={disabled}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Accept
        </button>
      </div>
      {decision && (
        <ResponseDialog
          uid={uid}
          application={application}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
    </article>
  );
}

function ResponseDialog({
  uid,
  application,
  decision,
  onClose,
}: {
  uid: string;
  application: OperateApplicationSummary;
  decision: 'accept' | 'decline';
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await respondToApplicationAs(
        uid,
        application.contractId,
        decision,
        decision === 'decline' ? reason : undefined
      );
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">
          {decision === 'accept' ? 'Accept application' : 'Decline application'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {decision === 'accept' ? (
            <>
              Sets contract <code className="rounded bg-muted px-1 py-0.5 text-xs">status=&apos;active&apos;</code>{' '}
              and pauses the source listing.
            </>
          ) : (
            <>
              Sets contract <code className="rounded bg-muted px-1 py-0.5 text-xs">status=&apos;cancelled&apos;</code>.
              Provide a reason — it is recorded on the contract and the audit event.
            </>
          )}{' '}
          Your uid is stamped via{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">_impersonatedByAdminUid</code>.
        </p>

        {decision === 'decline' && (
          <div className="mt-5">
            <Field label="Reason" required hint={`${reason.length} / 1000`}>
              <textarea
                rows={4}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              pending || (decision === 'decline' && reason.trim().length < 3)
            }
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              decision === 'accept'
                ? 'bg-primary text-primary-foreground hover:bg-roome-blue-dark'
                : 'bg-destructive text-white hover:bg-destructive/90'
            }`}
          >
            {pending
              ? decision === 'accept'
                ? 'Accepting…'
                : 'Declining…'
              : decision === 'accept'
                ? 'Accept'
                : 'Decline'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
