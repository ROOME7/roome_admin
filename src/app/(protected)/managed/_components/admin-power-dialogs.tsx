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
import { useT } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Waiver
// ---------------------------------------------------------------------------

export function WaiverButton({ account }: { account: ManagedAccount }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.waiverButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.waiverDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.waiverDialogSubtitle')}
        </p>

        <div className="mt-5 space-y-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
            />
            {t('managed.waiverActive_label')}
          </label>
          <Field
            label={t('managed.waiverReasonLabel')}
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
              placeholder={t('managed.waiverReasonPlaceholder')}
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              pending || (active && reason.trim().length < 3)
            }
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('common.saving') : t('common.save')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.connectButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.connectDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.connectDialogSubtitle', { name: heading })}
        </p>

        {!result && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t('managed.connectExistingAccountId')}{' '}
            <span className="font-mono">
              {account.stripeConnectAccountId ?? t('managed.connectNoneYet')}
            </span>
          </p>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {t('managed.connectSuccessMessage')}
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">{t('managed.connectDirectUrlLabel')}</p>
              <a
                href={result.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all font-mono text-primary hover:underline"
              >
                {result.onboardingUrl}
              </a>
              <p className="mt-2 font-mono text-muted-foreground">
                {t('managed.connectAcctLabel')} {result.accountId}
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
            {result ? t('common.close') : t('common.cancel')}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t('managed.connectGenerating') : t('managed.connectGenerate')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.notifyButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.notifyDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.notifyDialogSubtitle')}
        </p>

        {!result && (
          <div className="mt-5 space-y-4">
            <Field label={t('managed.notifyTitleLabel')} required hint={t('managed.notifyTitleHint', { count: title.length })}>
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
            <Field label={t('managed.notifyBodyLabel')} required hint={t('managed.notifyBodyHint', { count: body.length })}>
              <textarea
                rows={3}
                maxLength={240}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={pending}
                className="input"
                placeholder={t('managed.notifyBodyPlaceholder')}
              />
            </Field>
            <Field label={t('managed.notifyDeepLinkLabel')} hint={t('managed.notifyDeepLinkHint')}>
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
              ? t('managed.notifySuccessDelivered')
              : t('managed.notifySuccessNoToken')}
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
            {result ? t('common.close') : t('common.cancel')}
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
              {pending ? t('managed.notifySending') : t('managed.notifySend')}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {t('managed.refundsButton')}
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
  const t = useT();
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
        <h2 className="text-lg font-semibold text-foreground">{t('managed.refundsDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.refundsDialogSubtitle')}
        </p>

        <div className="mt-5 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">{t('managed.refundsLoadingInvoices')}</p>}
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
              {t('managed.refundsNoInvoices')}
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
            {t('common.close')}
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
  const t = useT();
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
            {' · '}{t('managed.refundPaid', { amount: euros(invoice.amountPaid) })}
            {invoice.refundedSoFar > 0 && (
              <span className="text-destructive">
                {' · '}{t('managed.refundRefunded', { amount: euros(invoice.refundedSoFar) })}
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
          {t('managed.refundButton')}
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
  const t = useT();
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
        setError(t('managed.refundPartialError', { max: remainingEur }));
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
        <h2 className="text-lg font-semibold text-destructive">{t('managed.refundInvoiceDialogTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('managed.refundInvoiceSubtitle', {
            number: invoice.number ?? invoice.invoiceId.slice(0, 12),
            max: remainingEur,
          })}
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
              {t('managed.refundFullLabel', { amount: remainingEur })}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === 'partial'}
                onChange={() => setMode('partial')}
                disabled={pending}
              />
              {t('managed.refundPartialLabel')}
            </label>
          </fieldset>
          {mode === 'partial' && (
            <Field label={t('managed.refundAmountLabel')} required>
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
          <Field label={t('managed.refundReasonLabel')} required hint={`${reason.length} / 1000`}>
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="input"
              placeholder={t('managed.refundReasonPlaceholder')}
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || reason.trim().length < 3}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('managed.refundSubmitting') : t('managed.refundSubmit')}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
