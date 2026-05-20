'use client';

// Applications tab on the Operate page. Lists pending tenant applications
// awaiting the partner-landlord's response, shows the applicant's profile +
// behaviour info (the same screening view a private owner gets in the
// Flutter app), and lets the admin accept or decline each one as the
// partner.

import { useState, useTransition } from 'react';
import { respondToApplicationAs } from '../actions';
import type { OperateApplicationSummary, OperateTenantProfile } from '../actions';
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

// Human labels for the 1–5 lifestyle sliders. Index 0 is unused (sliders
// are 1-based); kept so `LABELS[value]` reads directly.
const SCALE_LABELS = ['—', 'Very low', 'Low', 'Medium', 'High', 'Very high'];

function scaleLabel(v: number | null): string {
  if (v == null) return 'Not set';
  if (v < 1 || v > 5) return `${v}`;
  return `${SCALE_LABELS[v]} (${v}/5)`;
}

function boolLabel(v: boolean | null): string {
  if (v == null) return 'Not set';
  return v ? 'Yes' : 'No';
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
      {initial}
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

function BehaviourPanel({ profile }: { profile: OperateTenantProfile }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Behaviour &amp; lifestyle
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <InfoPair label="Cleanliness" value={scaleLabel(profile.cleanlinessLevel)} />
        <InfoPair label="Noise" value={scaleLabel(profile.noiseLevel)} />
        <InfoPair label="Sleep schedule" value={scaleLabel(profile.sleepSchedule)} />
        <InfoPair label="Sociability" value={scaleLabel(profile.sociability)} />
        <InfoPair label="Guests" value={scaleLabel(profile.guests)} />
        <InfoPair label="Smoker" value={boolLabel(profile.isSmoker)} />
        <InfoPair label="Pets" value={boolLabel(profile.hasPets)} />
        <InfoPair label="Cooks often" value={boolLabel(profile.cooksOften)} />
      </div>
      {profile.description && (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          {profile.description}
        </p>
      )}
    </div>
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
  const [showBehaviour, setShowBehaviour] = useState(false);
  const profile = application.profile;

  const displayName =
    profile?.displayName ?? application.tenantDisplayName;
  // Occupation line — profession + field of study when present.
  const occupationBits = [
    profile?.age != null ? `${profile.age} yrs` : null,
    profile?.profession,
    profile?.professionalArea && profile.professionalArea !== 'Indifferente'
      ? profile.professionalArea
      : null,
  ].filter(Boolean);

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-4">
        <Avatar url={profile?.photoUrl ?? null} name={displayName} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {occupationBits.length > 0
              ? occupationBits.join(' · ')
              : 'No profile details provided'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applied{' '}
            {application.appliedAt
              ? dateFormatter.format(application.appliedAt)
              : '—'}{' '}
            · room <span className="font-mono">{application.roomId || '—'}</span>
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
      </div>

      {profile ? (
        <>
          <button
            type="button"
            onClick={() => setShowBehaviour((v) => !v)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {showBehaviour ? 'Hide behaviour info' : 'Show behaviour info'}
          </button>
          {showBehaviour && <BehaviourPanel profile={profile} />}
        </>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">
          No profile on file for this applicant.
        </p>
      )}

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
