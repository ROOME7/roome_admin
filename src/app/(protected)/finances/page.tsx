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

export const dynamic = 'force-dynamic';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function FinancesPage() {
  await requireAdminSession();

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
          Finances
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roome&apos;s earnings — owner subscriptions and rent service fees,
          read straight from the Stripe balance ledger.
        </p>
      </header>

      {error || !data ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm font-medium text-destructive">
            Couldn&apos;t load financial data from Stripe.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </section>
      ) : (
        <FinancesBody data={data} />
      )}
    </div>
  );
}

function FinancesBody({ data }: { data: FinanceData }) {
  return (
    <>
      {data.truncated && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-700">
            The year-to-date ledger exceeded the fetch limit — figures below
            may be incomplete. Consider a nightly rollup.
          </p>
        </section>
      )}

      {/* Headline figures — month-to-date big, year-to-date underneath. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeadlineCard
          label="Net earnings"
          hint="Our cut after Stripe fees"
          mtd={data.mtd.netEarnings}
          ytd={data.ytd.netEarnings}
          tone="primary"
        />
        <HeadlineCard
          label="Gross cut"
          hint="Before Stripe processing fees"
          mtd={data.mtd.grossCut}
          ytd={data.ytd.grossCut}
        />
        <HeadlineCard
          label="Volume processed"
          hint="Every euro that moved through Roome"
          mtd={data.mtd.volume}
          ytd={data.ytd.volume}
        />
        <HeadlineCard
          label="Paid out to landlords"
          hint="Rent routed on to Connect accounts"
          mtd={data.mtd.landlordPayouts}
          ytd={data.ytd.landlordPayouts}
        />
      </section>

      <p className="-mt-4 text-xs text-muted-foreground">
        Figures reconcile with the Stripe balance ledger. Net earnings ={' '}
        gross cut − Stripe fees ({formatEur(data.ytd.stripeFees)} YTD) − refunds
        ({formatEur(data.ytd.refunds)} YTD).
      </p>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Net earnings by day"
          subtitle={data.monthLabel}
          points={data.daily}
          labelEvery={data.daily.length > 16 ? 5 : 2}
        />
        <ChartCard
          title="Net earnings by month"
          subtitle={data.yearLabel}
          points={data.monthly}
          labelEvery={1}
        />
      </section>

      {/* Breakdown by source */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SourceCard title={`This month · ${data.monthLabel}`} b={data.mtd} />
        <SourceCard title={`This year · ${data.yearLabel}`} b={data.ytd} />
      </section>

      {/* Payments trail */}
      <PaymentsTrail payments={data.payments} />

      <p className="text-xs text-muted-foreground">
        Generated {dateTimeFormatter.format(data.generatedAt)} · live from
        Stripe on every load.
      </p>
    </>
  );
}

function HeadlineCard({
  label,
  hint,
  mtd,
  ytd,
  tone = 'neutral',
}: {
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
        This month · {hint}
      </p>
      <p className="mt-3 border-t border-border pt-2 text-sm text-foreground">
        {formatEur(ytd)}
        <span className="ml-1.5 text-xs text-muted-foreground">
          year to date
        </span>
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  points,
  labelEvery,
}: {
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
          No earnings recorded yet.
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

function SourceCard({ title, b }: { title: string; b: MoneyBuckets }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-4 space-y-4">
        <SourceRow
          name="Owner subscriptions"
          meta={`${b.ownerSub.count} payment${b.ownerSub.count === 1 ? '' : 's'} · ${formatEur(b.ownerSub.volume)} billed`}
          value={b.ownerSub.net}
          valueLabel="earned"
        />
        <SourceRow
          name="Rent service fees"
          meta={`${b.rent.count} payment${b.rent.count === 1 ? '' : 's'} · ${formatEur(b.rent.volume)} rent processed`}
          value={b.rent.fees}
          valueLabel="in fees"
        />
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <dt className="text-sm font-semibold text-foreground">
            Net earnings
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

const KIND_BADGE: Record<PaymentKind, { label: string; cls: string }> = {
  subscription: {
    label: 'Subscription',
    cls: 'bg-primary/10 text-primary',
  },
  rent: { label: 'Rent', cls: 'bg-roome-blue/10 text-roome-blue' },
  other: { label: 'Other', cls: 'bg-secondary text-muted-foreground' },
};

const PAYMENTS_SHOWN = 200;

function PaymentsTrail({ payments }: { payments: PaymentRow[] }) {
  const shown = payments.slice(0, PAYMENTS_SHOWN);
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Payments — who paid what
        </h2>
        <span className="text-xs text-muted-foreground">
          {payments.length} this year
          {payments.length > PAYMENTS_SHOWN
            ? ` · showing ${PAYMENTS_SHOWN}`
            : ''}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No payments recorded this year yet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Payer</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 text-right font-medium">
                  Amount paid
                </th>
                <th className="px-5 py-2.5 text-right font-medium">
                  Roome&apos;s cut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((p) => (
                <PaymentRowItem key={p.id} payment={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PaymentRowItem({ payment }: { payment: PaymentRow }) {
  const badge = KIND_BADGE[payment.kind];
  const name = payment.payerName || payment.payerEmail || 'Unknown payer';
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
          {badge.label}
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
