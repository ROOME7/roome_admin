// /finances — Roome's earnings, month-to-date and year-to-date.
//
// Server Component, read-only. The (protected)/layout has already verified
// the caller is an admin. All figures come from loadFinanceData(), which
// reads Roome's Stripe balance ledger — see _lib/finance.ts for the model.
//
// The page never throws: if Stripe is unreachable it renders a neutral
// error panel rather than a 500, the same posture as the dashboard.

import 'server-only';
import Link from 'next/link';
import { requireAdminSession } from '@/lib/auth';
import {
  loadFinanceData,
  formatEur,
  type FinanceData,
  type MoneyBuckets,
  type ChartPoint,
  type PaymentRow,
  type PaymentKind,
} from './_lib/finance';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';

export const dynamic = 'force-dynamic';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function FinancesPage() {
  await requireAdminSession();
  const t = await getT();

  let data: FinanceData | null = null;
  let error: string | null = null;
  try {
    data = await loadFinanceData();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('finances.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('finances.subtitle')}
        </p>
      </header>

      {error || !data ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm font-medium text-destructive">
            {t('finances.errorLoad')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </section>
      ) : (
        <FinancesBody t={t} data={data} />
      )}
    </div>
  );
}

function FinancesBody({ t, data }: { t: TFunc; data: FinanceData }) {
  return (
    <>
      {data.truncated && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-700">
            {t('finances.truncatedWarning')}
          </p>
        </section>
      )}

      {/* Headline figures — month-to-date big, year-to-date underneath. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeadlineCard
          t={t}
          label={t('finances.headlineNetEarnings')}
          hint={t('finances.headlineNetEarningsHint')}
          mtd={data.mtd.netEarnings}
          ytd={data.ytd.netEarnings}
          tone="primary"
        />
        <HeadlineCard
          t={t}
          label={t('finances.headlineGrossCut')}
          hint={t('finances.headlineGrossCutHint')}
          mtd={data.mtd.grossCut}
          ytd={data.ytd.grossCut}
        />
        <HeadlineCard
          t={t}
          label={t('finances.headlineVolume')}
          hint={t('finances.headlineVolumeHint')}
          mtd={data.mtd.volume}
          ytd={data.ytd.volume}
        />
        <HeadlineCard
          t={t}
          label={t('finances.headlineLandlordPayouts')}
          hint={t('finances.headlineLandlordPayoutsHint')}
          mtd={data.mtd.landlordPayouts}
          ytd={data.ytd.landlordPayouts}
        />
      </section>

      <p className="-mt-4 text-xs text-muted-foreground">
        {t('finances.reconcileNote', {
          stripeFees: formatEur(data.ytd.stripeFees),
          refunds: formatEur(data.ytd.refunds),
        })}
      </p>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          t={t}
          title={t('finances.chartNetByDay')}
          subtitle={data.monthLabel}
          points={data.daily}
          labelEvery={data.daily.length > 16 ? 5 : 2}
        />
        <ChartCard
          t={t}
          title={t('finances.chartNetByMonth')}
          subtitle={data.yearLabel}
          points={data.monthly}
          labelEvery={1}
        />
      </section>

      {/* Breakdown by source */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SourceCard
          t={t}
          title={`${t('finances.thisMonth')} · ${data.monthLabel}`}
          b={data.mtd}
        />
        <SourceCard
          t={t}
          title={`${t('finances.thisYear')} · ${data.yearLabel}`}
          b={data.ytd}
        />
      </section>

      {/* Payments trail */}
      <PaymentsTrail t={t} payments={data.payments} />

      <p className="text-xs text-muted-foreground">
        {t('finances.generated', {
          datetime: dateTimeFormatter.format(data.generatedAt),
        })}
      </p>
    </>
  );
}

function HeadlineCard({
  t,
  label,
  hint,
  mtd,
  ytd,
  tone = 'neutral',
}: {
  t: TFunc;
  label: string;
  hint: string;
  mtd: number;
  ytd: number;
  tone?: 'neutral' | 'primary';
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-5 ${
        tone === 'primary' ? 'ring-1 ring-primary/30 bg-primary/5' : ''
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === 'primary' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {formatEur(mtd)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('finances.thisMonthHint', { hint })}
      </p>
      <p className="mt-3 border-t border-border pt-2 text-sm text-foreground">
        {formatEur(ytd)}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {t('finances.yearToDate')}
        </span>
      </p>
    </div>
  );
}

function ChartCard({
  t,
  title,
  subtitle,
  points,
  labelEvery,
}: {
  t: TFunc;
  title: string;
  subtitle: string;
  points: ChartPoint[];
  labelEvery: number;
}) {
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const height = 160;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>

      {total <= 0 ? (
        <div
          className="mt-4 flex items-center justify-center rounded-md bg-background text-sm text-muted-foreground"
          style={{ height }}
        >
          {t('finances.noEarnings')}
        </div>
      ) : (
        <>
          <div
            className="mt-4 flex items-end gap-1"
            style={{ height }}
            aria-hidden="true"
          >
            {points.map((p, i) => {
              const h =
                p.value > 0
                  ? Math.max(3, Math.round((p.value / max) * height))
                  : 2;
              return (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col justify-end"
                  style={{ height }}
                >
                  <div
                    className={`w-full rounded-sm transition-colors ${
                      p.value > 0
                        ? 'bg-roome-blue/80 group-hover:bg-roome-blue'
                        : 'bg-border'
                    }`}
                    style={{ height: h }}
                  />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background group-hover:block">
                    {p.label}: {formatEur(p.value)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1">
            {points.map((p, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px] text-muted-foreground"
              >
                {i % labelEvery === 0 || i === points.length - 1
                  ? p.label
                  : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SourceCard({ t, title, b }: { t: TFunc; title: string; b: MoneyBuckets }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-4 space-y-4">
        <SourceRow
          name={t('finances.sourceOwnerSub')}
          meta={`${
            b.ownerSub.count === 1
              ? t('finances.sourcePayment', { count: b.ownerSub.count })
              : t('finances.sourcePayments', { count: b.ownerSub.count })
          } · ${t('finances.sourceBilled', { amount: formatEur(b.ownerSub.volume) })}`}
          value={b.ownerSub.net}
          valueLabel={t('finances.sourceEarned')}
        />
        <SourceRow
          name={t('finances.sourceRentFees')}
          meta={`${
            b.rent.count === 1
              ? t('finances.sourcePayment', { count: b.rent.count })
              : t('finances.sourcePayments', { count: b.rent.count })
          } · ${t('finances.sourceRentProcessed', { amount: formatEur(b.rent.volume) })}`}
          value={b.rent.fees}
          valueLabel={t('finances.sourceInFees')}
        />
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <dt className="text-sm font-semibold text-foreground">
            {t('finances.sourceNetEarnings')}
          </dt>
          <dd className="text-sm font-semibold text-primary">
            {formatEur(b.netEarnings)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SourceRow({
  name,
  meta,
  value,
  valueLabel,
}: {
  name: string;
  meta: string;
  value: number;
  valueLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <dt className="text-sm font-medium text-foreground">{name}</dt>
        <dd className="mt-0.5 truncate text-xs text-muted-foreground">
          {meta}
        </dd>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold text-foreground">
          {formatEur(value)}
        </span>
        <span className="ml-1 text-xs text-muted-foreground">
          {valueLabel}
        </span>
      </div>
    </div>
  );
}

const KIND_BADGE: Record<PaymentKind, { cls: string }> = {
  subscription: {
    cls: 'bg-primary/10 text-primary',
  },
  rent: { cls: 'bg-roome-blue/10 text-roome-blue' },
  other: { cls: 'bg-secondary text-muted-foreground' },
};

const PAYMENTS_SHOWN = 200;

function PaymentsTrail({ t, payments }: { t: TFunc; payments: PaymentRow[] }) {
  const shown = payments.slice(0, PAYMENTS_SHOWN);
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t('finances.paymentsTitle')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t('finances.paymentsThisYear', { count: payments.length })}
          {payments.length > PAYMENTS_SHOWN
            ? ` ${t('finances.paymentsShowing', { shown: PAYMENTS_SHOWN })}`
            : ''}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {t('finances.paymentsEmpty')}
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">{t('finances.colDate')}</th>
                <th className="px-5 py-2.5 font-medium">{t('finances.colPayer')}</th>
                <th className="px-5 py-2.5 font-medium">{t('finances.colType')}</th>
                <th className="px-5 py-2.5 text-right font-medium">
                  {t('finances.colAmountPaid')}
                </th>
                <th className="px-5 py-2.5 text-right font-medium">
                  {t('finances.colRoomeCut')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((p) => (
                <PaymentRowItem key={p.id} t={t} payment={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PaymentRowItem({ t, payment }: { t: TFunc; payment: PaymentRow }) {
  const badge = KIND_BADGE[payment.kind];
  const badgeLabel =
    payment.kind === 'subscription'
      ? t('finances.badgeSubscription')
      : payment.kind === 'rent'
        ? t('finances.badgeRent')
        : t('finances.badgeOther');
  const name = payment.payerName || payment.payerEmail || t('finances.unknownPayer');
  return (
    <tr className="text-foreground">
      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
        {dateTimeFormatter.format(payment.created)}
      </td>
      <td className="px-5 py-3">
        <div className="min-w-0">
          {payment.payerUid ? (
            <Link
              href={`/users/${payment.payerUid}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{name}</span>
          )}
          {payment.payerName && payment.payerEmail && (
            <p className="truncate text-xs text-muted-foreground">
              {payment.payerEmail}
            </p>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
        >
          {badgeLabel}
        </span>
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
        {formatEur(payment.gross)}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-primary">
        {formatEur(payment.roomeCut)}
      </td>
    </tr>
  );
}
