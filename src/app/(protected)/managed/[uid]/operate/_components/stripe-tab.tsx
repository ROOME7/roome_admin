// T6: read-only Stripe state for the partner. Six sections, each rendered
// from the StripePartnerSnapshot fetched server-side on page load. Errors
// per section are non-fatal — one Stripe API hiccup doesn't take down the
// whole pane.

import Link from 'next/link';
import type {
  StripeConnectSummary,
  StripeCustomerSummary,
  StripeDisputeSummary,
  StripeInvoiceSummary,
  StripePartnerSnapshot,
  StripePaymentIntentSummary,
  StripeSubscriptionSummary,
} from '../actions';
import type { TFunc } from '@/i18n/t';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function fmtDate(unixSec: number | null | undefined): string {
  if (!unixSec) return '—';
  return dateFormatter.format(new Date(unixSec * 1000));
}
function fmtDateTime(unixSec: number | null | undefined): string {
  if (!unixSec) return '—';
  return dateTimeFormatter.format(new Date(unixSec * 1000));
}
function fmtMoney(cents: number, currency: string): string {
  const sign = currency === 'eur' ? '€' : currency.toUpperCase() + ' ';
  return `${sign}${(cents / 100).toFixed(2)}`;
}

export function StripeTab({ snapshot, t }: { snapshot: StripePartnerSnapshot; t: TFunc }) {
  if (!snapshot.hasStripeFootprint) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {t('operate.stripeEmpty')}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <CustomerCard
        customer={snapshot.customer}
        error={snapshot.customerError}
        t={t}
      />
      <SubscriptionCard
        sub={snapshot.subscription}
        error={snapshot.subscriptionError}
        t={t}
      />
      <ConnectCard
        connect={snapshot.connect}
        error={snapshot.connectError}
        t={t}
      />
      <InvoicesCard
        invoices={snapshot.invoices}
        error={snapshot.invoicesError}
        t={t}
      />
      <PaymentsCard
        payments={snapshot.payments}
        error={snapshot.paymentsError}
        t={t}
      />
      <DisputesCard
        disputes={snapshot.disputes}
        error={snapshot.disputesError}
        t={t}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------------

function SectionShell({
  title,
  count,
  error,
  empty,
  children,
  t,
}: {
  title: string;
  count?: number;
  error: string | null;
  empty?: string;
  children: React.ReactNode;
  t: TFunc;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          {count !== undefined && (
            <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {count}
            </span>
          )}
        </h3>
      </header>
      <div className="px-5 py-4">
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t('operate.stripeError', { error })}
          </p>
        ) : count === 0 && empty ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 break-all text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

// Tone-aware pill used by status badges across sections.
function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const tones: Record<typeof tone, string> = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-700',
    danger: 'bg-destructive/10 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function subscriptionStatusTone(
  status: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'success';
    case 'past_due':
    case 'incomplete':
      return 'warning';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'danger';
    default:
      return 'neutral';
  }
}

function invoiceStatusTone(
  status: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
    case 'draft':
      return 'warning';
    case 'uncollectible':
    case 'void':
      return 'danger';
    default:
      return 'neutral';
  }
}

function piStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_payment_method':
      return 'warning';
    case 'canceled':
      return 'danger';
    default:
      return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// 1. Customer
// ---------------------------------------------------------------------------

function CustomerCard({
  customer,
  error,
  t,
}: {
  customer: StripeCustomerSummary | null;
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell title={t('operate.stripeCustomerTitle')} error={error} count={customer ? undefined : 0} empty={t('operate.stripeCustomerEmpty')} t={t}>
      {customer && (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label={t('operate.stripeCustomerId')} value={customer.customerId} mono />
            <Field label={t('operate.stripeCustomerEmail')} value={customer.email ?? '—'} />
            <Field label={t('operate.stripeCustomerName')} value={customer.name ?? '—'} />
            <Field label={t('operate.stripeCustomerCreated')} value={fmtDate(customer.created)} />
            <Field
              label={t('operate.stripeCustomerDefaultPm')}
              value={customer.defaultPaymentMethodId ?? '—'}
              mono
            />
          </dl>
          <Link
            href={customer.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {t('operate.stripeOpenDashboard')}
          </Link>
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// 2. Owner subscription
// ---------------------------------------------------------------------------

function SubscriptionCard({
  sub,
  error,
  t,
}: {
  sub: StripeSubscriptionSummary | null;
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell
      title={t('operate.stripeSubscriptionTitle')}
      error={error}
      count={sub ? undefined : 0}
      empty={t('operate.stripeSubscriptionEmpty')}
      t={t}
    >
      {sub && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusPill
              label={sub.status}
              tone={subscriptionStatusTone(sub.status)}
            />
            {sub.cancelAtPeriodEnd && (
              <StatusPill label={t('operate.stripeSubCancelsAtEnd')} tone="warning" />
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label={t('operate.stripeSubId')} value={sub.subscriptionId} mono />
            <Field
              label={t('operate.stripeSubAmount')}
              value={t('operate.stripeSubAmountValue', { amount: fmtMoney(sub.amountCents, sub.currency) })}
            />
            <Field label={t('operate.stripeSubCollection')} value={sub.collectionMethod} />
            <Field label={t('operate.stripeSubPeriodStart')} value={fmtDate(sub.currentPeriodStart)} />
            <Field label={t('operate.stripeSubPeriodEnd')} value={fmtDate(sub.currentPeriodEnd)} />
            <Field
              label={t('operate.stripeSubCanceledAt')}
              value={sub.canceledAt ? fmtDate(sub.canceledAt) : '—'}
            />
            <Field label={t('operate.stripeSubPriceId')} value={sub.priceId} mono />
            <Field label={t('operate.stripeSubProductId')} value={sub.productId} mono />
          </dl>
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// 3. Connect account
// ---------------------------------------------------------------------------

function ConnectCard({
  connect,
  error,
  t,
}: {
  connect: StripeConnectSummary | null;
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell
      title={t('operate.stripeConnectTitle')}
      error={error}
      count={connect ? undefined : 0}
      empty={t('operate.stripeConnectEmpty')}
      t={t}
    >
      {connect && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={connect.chargesEnabled ? 'charges_enabled' : 'charges_disabled'}
              tone={connect.chargesEnabled ? 'success' : 'warning'}
            />
            <StatusPill
              label={connect.payoutsEnabled ? 'payouts_enabled' : 'payouts_disabled'}
              tone={connect.payoutsEnabled ? 'success' : 'warning'}
            />
            <StatusPill
              label={connect.detailsSubmitted ? 'details_submitted' : 'details_pending'}
              tone={connect.detailsSubmitted ? 'success' : 'warning'}
            />
            {connect.disabledReason && (
              <StatusPill label={connect.disabledReason} tone="danger" />
            )}
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label={t('operate.stripeConnectId')} value={connect.accountId} mono />
            <Field label={t('operate.stripeConnectType')} value={connect.type} />
            <Field label={t('operate.stripeConnectCountry')} value={connect.country ?? '—'} />
            <Field
              label={t('operate.stripeConnectPayout')}
              value={connect.defaultPayoutInterval ?? '—'}
            />
          </dl>

          {Object.keys(connect.capabilities).length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('operate.stripeConnectCapabilities')}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(connect.capabilities).map(([cap, status]) => (
                  <StatusPill
                    key={cap}
                    label={`${cap}: ${status}`}
                    tone={status === 'active' ? 'success' : 'warning'}
                  />
                ))}
              </div>
            </div>
          )}

          {(connect.requirementsCurrentlyDue.length > 0 ||
            connect.requirementsPastDue.length > 0) && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              <p className="font-medium">{t('operate.stripeConnectRequirements')}</p>
              {connect.requirementsPastDue.length > 0 && (
                <p className="mt-1">
                  <strong>{t('operate.stripeConnectPastDue')}</strong>{' '}
                  <span className="font-mono">
                    {connect.requirementsPastDue.join(', ')}
                  </span>
                </p>
              )}
              {connect.requirementsCurrentlyDue.length > 0 && (
                <p className="mt-1">
                  <strong>{t('operate.stripeConnectCurrentlyDue')}</strong>{' '}
                  <span className="font-mono">
                    {connect.requirementsCurrentlyDue.join(', ')}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// 4. Invoices
// ---------------------------------------------------------------------------

function InvoicesCard({
  invoices,
  error,
  t,
}: {
  invoices: StripeInvoiceSummary[];
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell
      title={t('operate.stripeInvoicesTitle')}
      count={invoices.length}
      error={error}
      empty={t('operate.stripeInvoicesEmpty')}
      t={t}
    >
      <ul className="space-y-2">
        {invoices.map((inv) => (
          <li
            key={inv.invoiceId}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {inv.number ?? inv.invoiceId.slice(0, 14)}
                <span className="ml-2">
                  <StatusPill label={inv.status} tone={invoiceStatusTone(inv.status)} />
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtDate(inv.created)}
                {' · '}
                {fmtMoney(inv.amountPaid, inv.currency)} {t('operate.stripePaid')}
                {inv.amountRemaining > 0 && (
                  <span className="text-amber-700">
                    {' · '}
                    {t('operate.stripeRemaining', { amount: fmtMoney(inv.amountRemaining, inv.currency) })}
                  </span>
                )}
              </p>
            </div>
            {inv.hostedInvoiceUrl && (
              <Link
                href={inv.hostedInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                {t('operate.stripeHostedLink')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// 5. PaymentIntents (rent + one-offs)
// ---------------------------------------------------------------------------

function PaymentsCard({
  payments,
  error,
  t,
}: {
  payments: StripePaymentIntentSummary[];
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell
      title={t('operate.stripePaymentsTitle')}
      count={payments.length}
      error={error}
      empty={t('operate.stripePaymentsEmpty')}
      t={t}
    >
      <ul className="space-y-2">
        {payments.map((pi) => (
          <li
            key={pi.paymentIntentId}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-foreground">
                {pi.paymentIntentId}
                <span className="ml-2">
                  <StatusPill label={pi.status} tone={piStatusTone(pi.status)} />
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtDateTime(pi.created)}
                {' · '}
                {fmtMoney(pi.amount, pi.currency)}
                {pi.paymentMethodTypes.length > 0 && (
                  <span> · {pi.paymentMethodTypes.join(', ')}</span>
                )}
              </p>
              {pi.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {pi.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// 6. Disputes
// ---------------------------------------------------------------------------

function DisputesCard({
  disputes,
  error,
  t,
}: {
  disputes: StripeDisputeSummary[];
  error: string | null;
  t: TFunc;
}) {
  return (
    <SectionShell
      title={t('operate.stripeDisputesTitle')}
      count={disputes.length}
      error={error}
      empty={t('operate.stripeDisputesEmpty')}
      t={t}
    >
      <ul className="space-y-2">
        {disputes.map((d) => (
          <li
            key={d.disputeId}
            className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-foreground">
                {d.disputeId}
                <span className="ml-2">
                  <StatusPill label={d.status} tone="danger" />
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtMoney(d.amount, d.currency)}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('operate.stripeDisputeReason')} <span className="font-medium text-foreground">{d.reason}</span>
              {' · '}
              {t('operate.stripeDisputeOpened', { date: fmtDate(d.created) })}
              {d.evidenceDueBy && (
                <span className="text-amber-700">
                  {' · '}{t('operate.stripeDisputeEvidenceDue', { date: fmtDate(d.evidenceDueBy) })}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
