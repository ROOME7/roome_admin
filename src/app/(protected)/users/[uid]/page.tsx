// /users/[uid] — full read-only detail view of a single account.
//
// Server Component. ONE round trip: `GET /admin/users/{id}` returns the
// account plus the tenant profile, the company paperwork, the B2B
// application, the Stripe linkage, both directions of the block list and the
// relationship counts.
//
// ⚠️ THIS USED TO READ FIRESTORE — `users/{uid}` and `userProfiles/{uid}`,
// with the blocks panel fetching names ten at a time from a third place. That
// data is gone; more to the point, the panel was deriving facts (the role, the
// status, the badges) from raw documents, which is how a screen ends up
// disagreeing with the product about who is suspended. Everything below is
// rendered, not decided.

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import {
  kindOf,
  ownerTypeOf,
  roleLabel,
  statusOf,
  type ApiUserDetail,
} from '../_lib/user-model';
import { BlocksPanel } from './_components/blocks-panel';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function fmt(value: unknown, t: TFunc): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (typeof value === 'number') return String(value);
  return String(value);
}

/** An ISO instant → local display. Null and absent both read as an em-dash. */
function fmtAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
}

/** A `YYYY-MM-DD` date — no time of day, so no timezone to get wrong. */
function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return dateFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

/** Years since a `YYYY-MM-DD` birth date, or null when there isn't one. */
function ageFrom(date: string | null): number | null {
  if (!date) return null;
  const born = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  // Birthday not reached yet this year.
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

type Params = Promise<{ uid: string }>;

export default async function UserDetailPage({ params }: { params: Params }) {
  await requireAdminSession();
  const t = await getT();
  const { uid } = await params;

  // `apiAuthed` turns a 404 into null — an id nobody has is a not-found page,
  // not an error page.
  const u = await apiAuthed<ApiUserDetail>(`/admin/users/${encodeURIComponent(uid)}`);
  if (!u) notFound();

  const kind = kindOf(u.role);
  const ownerType = ownerTypeOf(u.ownerKind);
  const status = statusOf(u.status);
  const headline = u.fullName || u.companyName || u.username;
  const age = ageFrom(u.birthDate);
  const tp = u.tenantProfile;

  const statusBadgeKey =
    status === 'active'
      ? 'common.statusActive'
      : status === 'suspended'
        ? 'common.statusSuspended'
        : 'common.statusArchived';

  return (
    <div className="space-y-8">
      <div className="text-sm text-muted-foreground">
        <Link href="/users" className="hover:text-foreground">
          {t('users.backToUsers')}
        </Link>
      </div>

      {/* Header */}
      <header className="flex items-start gap-4">
        {u.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.photoUrl}
            alt={headline}
            className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-foreground">
            {headline.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {headline}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fmt(u.email, t)} · @{u.username.replace(/^@/, '')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{roleLabel(kind, ownerType, t)}</Badge>
            <Badge
              tone={status === 'active' ? 'good' : status === 'suspended' ? 'warning' : 'bad'}
            >
              {t(statusBadgeKey)}
            </Badge>
            {u.identityVerifiedAt && (
              <Badge tone="info">{t('users.badgeIdentityVerified')}</Badge>
            )}
            {!u.emailVerified && (
              <Badge tone="warning">{t('users.badgeEmailUnverified')}</Badge>
            )}
          </div>
        </div>
      </header>

      <Section title={t('users.sectionIdentity')}>
        <Field label={t('users.fieldFullName')} value={fmt(u.fullName, t)} />
        <Field label={t('users.fieldUsername')} value={fmt(u.username, t)} />
        <Field label={t('users.fieldEmail')} value={fmt(u.email, t)} />
        <Field label={t('users.fieldEmailVerified')} value={fmt(u.emailVerified, t)} />
        <Field label={t('users.fieldPhone')} value={fmt(u.phoneNumber, t)} />
        <Field label={t('users.fieldBirthDate')} value={fmtDate(u.birthDate)} />
        <Field label={t('users.fieldGender')} value={fmt(u.gender, t)} />
        <Field label="UID" value={fmt(u.id, t)} mono />
      </Section>

      <Section title={t('users.sectionAccount')}>
        <Field label={t('users.fieldRole')} value={roleLabel(kind, ownerType, t)} />
        <Field label={t('users.fieldRoleConfirmed')} value={fmtAt(u.roleConfirmedAt)} />
        <Field label={t('users.fieldProfileCompleted')} value={fmt(u.profileCompleted, t)} />
        <Field label={t('users.fieldAuthProvider')} value={fmt(u.authProvider, t)} />
        <Field label={t('users.fieldLocale')} value={fmt(u.locale, t)} />
        <Field label={t('users.fieldCreated')} value={fmtAt(u.createdAt)} />
        <Field label={t('users.fieldLastUpdated')} value={fmtAt(u.updatedAt)} />
        <Field label={t('users.fieldLastSeen')} value={fmtAt(u.lastSeenAt)} />
      </Section>

      {kind === 'tenant' && (
        <Section title={t('users.sectionTenantProfile')}>
          {tp ? (
            <>
              <Field label={t('users.fieldAge')} value={fmt(age, t)} />
              <Field label={t('users.fieldProfession')} value={fmt(tp.profession, t)} />
              <Field label={t('users.fieldFieldArea')} value={fmt(tp.professionalArea, t)} />
              <Field label={t('users.fieldUniversity')} value={fmt(tp.universityName, t)} />
              <Field label={t('users.fieldCleanliness')} value={scale(tp.cleanlinessLevel)} />
              <Field label={t('users.fieldNoise')} value={scale(tp.noiseLevel)} />
              <Field label={t('users.fieldSleepSchedule')} value={scale(tp.sleepSchedule)} />
              <Field label={t('users.fieldSociability')} value={scale(tp.sociability)} />
              <Field label={t('users.fieldGuests')} value={scale(tp.guests)} />
              <Field label={t('users.fieldSmoker')} value={fmt(tp.isSmoker, t)} />
              <Field label={t('users.fieldHasPets')} value={fmt(tp.hasPets, t)} />
              <Field label={t('users.fieldCooksOften')} value={fmt(tp.cooksOften, t)} />
              <Field label={t('users.fieldBio')} value={fmt(u.bio, t)} wide />
              <Field label={t('users.fieldBioModerated')} value={fmtAt(u.bioModeratedAt)} />
            </>
          ) : (
            // An empty profile is a fact about the account, not a broken page:
            // it is exactly what an admin chasing a stalled signup is looking
            // for.
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {t('users.noTenantProfile')}
            </p>
          )}
        </Section>
      )}

      {kind === 'landlord' && (
        <Section title={t('users.sectionLandlord')}>
          <Field
            label={t('users.fieldOwnerType')}
            value={ownerType === 'b2b' ? t('users.ownerTypeB2b') : t('users.ownerTypeB2c')}
          />
          <Field label={t('users.fieldProperties')} value={fmt(u.counts.properties, t)} />
          <Field label={t('users.fieldCompanyName')} value={fmt(u.ownerProfile?.companyName, t)} />
          <Field label={t('users.fieldVatNumber')} value={fmt(u.ownerProfile?.vatNumber, t)} mono />
          <Field
            label={t('users.fieldFiscalCode')}
            value={fmt(u.ownerProfile?.fiscalCode, t)}
            mono
          />
          <Field label="PEC" value={fmt(u.ownerProfile?.pec, t)} />
          <Field label={t('users.fieldAdminName')} value={fmt(u.ownerProfile?.adminName, t)} />
        </Section>
      )}

      {u.b2bRequest && (
        <Section title={t('users.sectionB2bRequest')}>
          <Field label={t('users.fieldTicketRef')} value={fmt(u.b2bRequest.ticketRef, t)} mono />
          <Field label={t('users.fieldB2bApproval')} value={fmt(u.b2bRequest.status, t)} />
          <Field label={t('users.fieldCompanyName')} value={fmt(u.b2bRequest.companyName, t)} />
          <Field label={t('users.fieldVatNumber')} value={fmt(u.b2bRequest.vatNumber, t)} mono />
          <Field label={t('users.fieldRequestSubmitted')} value={fmtAt(u.b2bRequest.createdAt)} />
          <Field label={t('users.fieldReviewedAt')} value={fmtAt(u.b2bRequest.reviewedAt)} />
          <Field label={t('users.fieldNotes')} value={fmt(u.b2bRequest.notes, t)} wide />
        </Section>
      )}

      <Section title={t('users.sectionVerification')}>
        <Field
          label={t('users.fieldIdentityVerification')}
          value={fmt(u.identityStatus, t)}
        />
        <Field
          label={t('users.fieldIdentityVerifiedAt')}
          value={fmtAt(u.identityVerifiedAt)}
        />
        <Field
          label={t('users.fieldIdentityFailure')}
          value={fmt(u.identityFailureReason, t)}
          wide
        />
        <Field label={t('users.fieldVerifiedTenant')} value={fmt(u.verifiedTenant, t)} />
        <Field label={t('users.fieldVerifiedOwner')} value={fmt(u.verifiedOwner, t)} />
        <Field label={t('users.fieldReviews')} value={fmt(u.reviewCount, t)} />
        <Field
          label={t('users.fieldAverageRating')}
          value={u.reviewCount > 0 ? u.averageRating.toFixed(2) : '—'}
        />
      </Section>

      <Section title="Stripe" note={t('users.stripeNote')}>
        {u.stripe.customerId || u.stripe.connect || u.stripe.subscription ? (
          <>
            <Field label={t('users.fieldStripeMode')} value={fmt(u.stripe.mode, t)} />
            <Field label={t('users.fieldCustomerId')} value={fmt(u.stripe.customerId, t)} mono />
            {u.stripe.connect && (
              <>
                <Field
                  label={t('users.fieldConnectAccountId')}
                  value={fmt(u.stripe.connect.accountId, t)}
                  mono
                />
                <Field
                  label={t('users.fieldConnectChargesEnabled')}
                  value={fmt(u.stripe.connect.chargesEnabled, t)}
                />
                <Field
                  label={t('users.fieldConnectPayoutsEnabled')}
                  value={fmt(u.stripe.connect.payoutsEnabled, t)}
                />
                <Field
                  label={t('users.fieldConnectDisabledReason')}
                  value={fmt(u.stripe.connect.disabledReason, t)}
                />
                <Field
                  label={t('users.fieldRequirementsDue')}
                  value={fmt(u.stripe.connect.requirementsDue.join(', '), t)}
                  wide
                />
              </>
            )}
            {u.stripe.subscription && (
              <>
                <Field
                  label={t('users.fieldOwnerSubscription')}
                  value={`${u.stripe.subscription.status} · ${u.stripe.subscription.interval}`}
                />
                <Field
                  label={t('users.fieldSubscriptionId')}
                  value={fmt(u.stripe.subscription.id, t)}
                  mono
                />
                <Field
                  label={t('users.fieldSubscriptionRenews')}
                  value={fmtAt(u.stripe.subscription.currentPeriodEnd)}
                />
                <Field
                  label={t('users.fieldSubscriptionWaiver')}
                  value={fmt(u.stripe.subscription.waiverActive, t)}
                />
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">{t('users.noStripe')}</p>
        )}
      </Section>

      <Section title={t('users.sectionActivity')}>
        <Field label={t('users.fieldProperties')} value={fmt(u.counts.properties, t)} />
        <Field
          label={t('users.fieldContractsAsTenant')}
          value={fmt(u.counts.contractsAsTenant, t)}
        />
        <Field
          label={t('users.fieldContractsAsLandlord')}
          value={fmt(u.counts.contractsAsLandlord, t)}
        />
        <Field label={t('users.fieldReviews')} value={fmt(u.reviewCount, t)} />
        <Field label={t('users.fieldReportsAgainst')} value={fmt(u.counts.reportsAgainst, t)} />
        <Field label={t('users.fieldReportsMade')} value={fmt(u.counts.reportsMade, t)} />
      </Section>

      <Section title={t('users.sectionLegal')}>
        <Field label={t('users.fieldConsentVersion')} value={fmt(u.consent.version, t)} />
        <Field label={t('users.fieldConsentAccepted')} value={fmtAt(u.consent.acceptedAt)} />
        <Field label={t('users.fieldConfirmedAge18')} value={fmt(u.consent.confirmedAge18, t)} />
        <Field label={t('users.fieldMessagingConsent')} value={fmt(u.consent.messaging, t)} />
      </Section>

      {status !== 'active' && (
        <Section title={t('users.sectionAccountStatus')}>
          {status === 'suspended' && (
            <>
              <Field label={t('users.fieldSuspended')} value={fmtAt(u.suspendedAt)} />
              <Field label={t('users.fieldReason')} value={fmt(u.suspendedReason, t)} wide />
            </>
          )}
          {status === 'archived' && (
            <>
              <Field label={t('users.fieldArchived')} value={fmtAt(u.deletedAt)} />
              <Field label={t('users.fieldPurgeAt')} value={fmtAt(u.purgeAt)} />
            </>
          )}
        </Section>
      )}

      <BlocksPanel
        made={u.blocks.made}
        received={u.blocks.received}
        madeTotal={u.counts.blocksMade}
        receivedTotal={u.counts.blocksReceived}
        t={t}
      />

      {/* The record as the API returns it — nothing above is hidden or added. */}
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground">
          {t('users.rawRecord')}
        </summary>
        <div className="space-y-2 border-t border-border p-5">
          <p className="font-mono text-xs text-muted-foreground">
            {t('users.rawRecordNote', { id: u.id })}
          </p>
          <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs text-foreground">
            {JSON.stringify(u, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

function scale(v: number | null): string {
  return typeof v === 'number' ? `${v} / 5` : '—';
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-sm text-foreground ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {String(value ?? '—')}
      </dd>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'neutral' | 'good' | 'warning' | 'bad' | 'info';
}) {
  const cls = {
    neutral: 'bg-secondary text-muted-foreground',
    good: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-700',
    bad: 'bg-destructive/10 text-destructive',
    info: 'bg-primary/10 text-primary',
  }[tone];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}
