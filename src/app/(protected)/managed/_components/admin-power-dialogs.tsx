'use client';

// T4 — Admin powers, account-level. Four dialogs:
//   - <WaiverButton>: toggle the €150/yr subscription waiver
//   - <ConnectOnboardingButton>: send the partner a Stripe Connect link
//   - <NotifyButton>: custom FCM push to the partner
//   - <RefundsButton>: list owner-sub invoices + refund partial / full
//
// Grant/revoke admin role is a separate top-level /admins page, not a
// per-account dialog — see app/(protected)/admins/.

import { useEffect, useState, useTransition } from 'react';
import {
  listOwnerSubInvoices,
  refundOwnerSubInvoice,
  sendPartnerNotification,
  setSubscriptionWaiver,
  triggerConnectOnboarding,
  type SubInvoiceSummary,
} from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { Field, InputStyles, Overlay } from './dialog-primitives';

// ---------------------------------------------------------------------------
// Waiver
// ---------------------------------------------------------------------------

export function WaiverButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Waiver
      </button>
      {open && <WaiverDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function WaiverDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(account.subscriptionWaiverActive);
  const [reason, setReason] = useState(account.subscriptionWaiverReason ?? '');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await setSubscriptionWaiver(account.uid, active, reason);
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Subscription waiver</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bypasses the €150/yr owner-subscription gate independently of
          managed/handed-over state. Use for strategic partners who keep their
          account post-handover but shouldn&apos;t be charged.
        </p>

        <div className="mt-5 space-y-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
            />
            Waiver active
          </label>
          <Field
            label="Reason"
            required={active}
            hint={`${reason.length} / 1000`}
          >
            <textarea
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending || !active}
              className="input"
              placeholder="Why does this partner get a waiver?"
            />
          </Field>
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
            onClick={submit}
            disabled={
              pending || (active && reason.trim().length < 3)
            }
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

// ---------------------------------------------------------------------------
// Connect onboarding trigger
// ---------------------------------------------------------------------------

export function ConnectOnboardingButton({
  account,
}: {
  account: ManagedAccount;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Connect
      </button>
      {open && (
        <ConnectOnboardingDialog account={account} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ConnectOnboardingDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ onboardingUrl: string; accountId: string } | null>(
    null
  );

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await triggerConnectOnboarding(account.uid);
      if (res.ok) {
        setResult({
          onboardingUrl: res.onboardingUrl,
          accountId: res.accountId,
        });
      } else {
        setError(res.error);
      }
    });
  }

  const heading = account.companyName ?? account.displayUsername;

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Stripe Connect onboarding</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Generates a fresh Stripe Account Link for <strong>{heading}</strong>{' '}
          and pushes it to them via FCM + notifications doc. The link is
          single-use and short-lived; resend any time. Creating an Express
          account is idempotent.
        </p>

        {!result && (
          <p className="mt-4 text-xs text-muted-foreground">
            Existing account ID:{' '}
            <span className="font-mono">
              {account.stripeConnectAccountId ?? '(none yet — will create)'}
            </span>
          </p>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              Onboarding link generated and pushed to the partner.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">Direct URL (also share manually if needed):</p>
              <a
                href={result.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all font-mono text-primary hover:underline"
              >
                {result.onboardingUrl}
              </a>
              <p className="mt-2 font-mono text-muted-foreground">
                acct: {result.accountId}
              </p>
            </div>
          </div>
        )}

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
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Generating…' : 'Generate link & notify'}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Notify
// ---------------------------------------------------------------------------

export function NotifyButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Notify
      </button>
      {open && <NotifyDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function NotifyDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [result, setResult] = useState<{ delivered: boolean } | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await sendPartnerNotification(
        account.uid,
        title,
        body,
        deepLink || null
      );
      if (res.ok) {
        setResult({ delivered: res.delivered });
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Send partner notification</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Writes a doc to <code className="rounded bg-muted px-1 py-0.5 text-xs">notifications/</code>
          {' '}and best-effort delivers a push via FCM. Use sparingly — partners
          have FCM-quieting expectations.
        </p>

        {!result && (
          <div className="mt-5 space-y-4">
            <Field label="Title" required hint={`${title.length} / 60`}>
              <input
                type="text"
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="e.g. Verifica IBAN"
              />
            </Field>
            <Field label="Body" required hint={`${body.length} / 240`}>
              <textarea
                rows={3}
                maxLength={240}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="Short message — under 240 chars."
              />
            </Field>
            <Field label="Deep link" hint="Optional in-app URL">
              <input
                type="text"
                maxLength={500}
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                disabled={pending}
                className="input"
                placeholder="roome://owner/listings/abc"
              />
            </Field>
          </div>
        )}

        {result && (
          <p
            className={`mt-4 rounded-md px-3 py-2 text-sm ${
              result.delivered
                ? 'bg-primary/10 text-primary'
                : 'bg-amber-500/10 text-amber-700'
            }`}
          >
            {result.delivered
              ? 'Pushed to the partner’s device.'
              : 'Notification doc written, but no FCM token on file — partner will see it next time they sign in.'}
          </p>
        )}

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
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={
                pending || title.trim().length < 3 || body.trim().length < 3
              }
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Sending…' : 'Send'}
            </button>
          )}
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export function RefundsButton({ account }: { account: ManagedAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Refunds
      </button>
      {open && <RefundsDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function RefundsDialog({
  account,
  onClose,
}: {
  account: ManagedAccount;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<SubInvoiceSummary[]>([]);

  useEffect(() => {
    let alive = true;
    listOwnerSubInvoices(account.uid)
      .then((res) => {
        if (!alive) return;
        if (res.ok) setInvoices(res.invoices);
        else setLoadError(res.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [account.uid]);

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Owner subscription refunds</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Lists this partner&apos;s €150/yr invoices from Stripe. Refund partially
          or in full per invoice. Rent-payment refunds are NOT shown here — those
          happen on the partner&apos;s Connected Account.
        </p>

        <div className="mt-5 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
          {loadError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {loadError}
            </p>
          )}
          {!loading && !loadError && invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No owner-subscription invoices found. (Partner may not have a
              Stripe customer record, or hasn&apos;t paid the subscription yet.)
            </p>
          )}
          {invoices.map((inv) => (
            <InvoiceRow
              key={inv.invoiceId}
              uid={account.uid}
              invoice={inv}
              onRefunded={(amountRefunded) => {
                setInvoices((arr) =>
                  arr.map((x) =>
                    x.invoiceId === inv.invoiceId
                      ? {
                          ...x,
                          refundedSoFar: x.refundedSoFar + amountRefunded,
                          amountRemaining: Math.max(
                            0,
                            x.amountRemaining - amountRefunded
                          ),
                        }
                      : x
                  )
                );
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function InvoiceRow({
  uid,
  invoice,
  onRefunded,
}: {
  uid: string;
  invoice: SubInvoiceSummary;
  onRefunded: (amountCents: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const euros = (cents: number) => (cents / 100).toFixed(2);
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {invoice.number ?? invoice.invoiceId.slice(0, 12)}
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {invoice.status}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {invoice.created ? dateFormatter.format(new Date(invoice.created * 1000)) : '—'}
            {' · '}€{euros(invoice.amountPaid)} paid
            {invoice.refundedSoFar > 0 && (
              <span className="text-destructive">
                {' · '}€{euros(invoice.refundedSoFar)} refunded
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={invoice.amountRemaining === 0}
          className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Refund
        </button>
      </div>

      {open && (
        <RefundInvoiceDialog
          uid={uid}
          invoice={invoice}
          onClose={() => setOpen(false)}
          onSuccess={(amountCents) => {
            onRefunded(amountCents);
            setOpen(false);
          }}
        />
      )}
    </article>
  );
}

function RefundInvoiceDialog({
  uid,
  invoice,
  onClose,
  onSuccess,
}: {
  uid: string;
  invoice: SubInvoiceSummary;
  onClose: () => void;
  onSuccess: (amountCents: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partialEuros, setPartialEuros] = useState('');
  const [reason, setReason] = useState('');

  const remainingEur = (invoice.amountRemaining / 100).toFixed(2);

  function submit() {
    setError(null);
    const amount: number | 'full' =
      mode === 'full'
        ? 'full'
        : Math.round(Number.parseFloat(partialEuros) * 100);
    if (mode === 'partial') {
      if (
        !Number.isFinite(amount as number) ||
        (amount as number) <= 0 ||
        (amount as number) > invoice.amountRemaining
      ) {
        setError(`Partial amount must be 0.01..${remainingEur} EUR.`);
        return;
      }
    }
    startTransition(async () => {
      const res = await refundOwnerSubInvoice(uid, invoice.invoiceId, amount, reason);
      if (res.ok) {
        onSuccess(res.amountRefunded);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-destructive">Refund invoice</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Invoice <span className="font-mono">{invoice.number ?? invoice.invoiceId.slice(0, 12)}</span>.
          Up to <strong>€{remainingEur}</strong> refundable.
        </p>

        <div className="mt-5 space-y-4">
          <fieldset className="space-y-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                disabled={pending}
              />
              Refund full remaining (€{remainingEur})
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === 'partial'}
                onChange={() => setMode('partial')}
                disabled={pending}
              />
              Refund partial amount
            </label>
          </fieldset>
          {mode === 'partial' && (
            <Field label="Amount (EUR)" required>
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={invoice.amountRemaining / 100}
                value={partialEuros}
                onChange={(e) => setPartialEuros(e.target.value)}
                disabled={pending}
                className="input"
              />
            </Field>
          )}
          <Field label="Reason" required hint={`${reason.length} / 1000`}>
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="Internal note — visible only to admins."
            />
          </Field>
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
            onClick={submit}
            disabled={pending || reason.trim().length < 3}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Refunding…' : 'Refund'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
