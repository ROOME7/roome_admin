// /users/[uid] — full read-only detail view of a single user.
//
// Server Component. Reads users/{uid} (the canonical account doc — the
// Flutter app writes everything here) plus userProfiles/{uid} (the public
// mirror: avatar, verification badges, reputation). Renders curated
// sections + a raw-document dump so nothing is hidden from the admin.

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import { classify, deriveStatus, roleLabel, tsToDate } from '../_lib/user-model';
import { BlocksPanel } from './_components/blocks-panel';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function fmt(value: unknown, t: TFunc): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (value instanceof Date) return dateFormatter.format(value);
  if (typeof value === 'number') return String(value);
  return String(value);
}

// JSON.stringify replacer — Firestore Timestamps + DocumentReferences
// serialise to noise otherwise.
function rawReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (
      typeof v._seconds === 'number' &&
      typeof v._nanoseconds === 'number'
    ) {
      return new Date(v._seconds * 1000).toISOString();
    }
    if (typeof v.path === 'string' && v.id !== undefined && v.parent) {
      return `→ ${v.path}`;
    }
  }
  return value;
}

type Params = Promise<{ uid: string }>;

export default async function UserDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireAdminSession();
  const t = await getT();
  const { uid } = await params;

  const db = serverDb();
  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('userProfiles').doc(uid).get(),
  ]);
  if (!userSnap.exists) notFound();

  const d = userSnap.data() ?? {};
  const profile = profileSnap.exists ? profileSnap.data() ?? {} : {};

  const { kind, ownerType } = classify(d);
  const status = deriveStatus(d);
  const name = typeof d.name === 'string' ? d.name : '';
  const surname = typeof d.surname === 'string' ? d.surname : '';
  const fullName =
    (typeof d.fullName === 'string' && d.fullName) ||
    [name, surname].filter(Boolean).join(' ') ||
    null;
  const displayName =
    (typeof d.displayUsername === 'string' && d.displayUsername) ||
    (typeof d.username === 'string' && d.username) ||
    '(unnamed)';
  const headline = fullName || (d.companyName as string) || displayName;
  const photoUrl =
    (typeof profile.photoUrl === 'string' && profile.photoUrl) ||
    (typeof d.profilePicture === 'string' && d.profilePicture) ||
    null;

  const housesOwned = Array.isArray(d.housesOwned) ? d.housesOwned.length : 0;
  const sub =
    d.ownerSubscription && typeof d.ownerSubscription === 'object'
      ? (d.ownerSubscription as Record<string, unknown>)
      : null;
  const badges =
    profile.badges && typeof profile.badges === 'object'
      ? (profile.badges as Record<string, unknown>)
      : {};
  const reputation =
    profile.reputation && typeof profile.reputation === 'object'
      ? (profile.reputation as Record<string, unknown>)
      : {};

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
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
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
            {fmt(d.email, t)} · @{displayName.replace(/^@/, '')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{roleLabel(kind, ownerType, t)}</Badge>
            <Badge
              tone={
                status === 'active'
                  ? 'good'
                  : status === 'suspended'
                    ? 'warning'
                    : 'bad'
              }
            >
              {t(statusBadgeKey)}
            </Badge>
            {d.managedBy && <Badge tone="info">{t('users.badgeManagedAccount')}</Badge>}
          </div>
        </div>
      </header>

      <Section title={t('users.sectionIdentity')}>
        <Field label={t('users.fieldFullName')} value={fmt(fullName, t)} />
        <Field label={t('users.fieldUsername')} value={fmt(displayName, t)} />
        <Field label={t('users.fieldEmail')} value={fmt(d.email, t)} />
        <Field label={t('users.fieldEmailVerified')} value={fmt(d.emailVerified === true, t)} />
        <Field label={t('users.fieldPhone')} value={fmt(d.phoneNumber, t)} />
        <Field label="UID" value={fmt(uid, t)} mono />
      </Section>

      <Section title={t('users.sectionAccount')}>
        <Field label={t('users.fieldRole')} value={roleLabel(kind, ownerType, t)} />
        <Field label={t('users.fieldProfileCompleted')} value={fmt(d.profileCompleted === true, t)} />
        <Field label={t('users.fieldCreated')} value={fmt(tsToDate(d.createdAt), t)} />
        <Field
          label={t('users.fieldLastUpdated')}
          value={fmt(tsToDate(d.updatedAt), t)}
        />
        <Field label={t('users.fieldAuthProvider')} value={fmt(d.authProvider ?? 'password', t)} />
      </Section>

      {kind === 'tenant' && (
        <Section title={t('users.sectionTenantProfile')}>
          <Field label={t('users.fieldAge')} value={fmt(d.age, t)} />
          <Field label={t('users.fieldGender')} value={fmt(d.gender, t)} />
          <Field label={t('users.fieldProfession')} value={fmt(d.profession, t)} />
          <Field label={t('users.fieldFieldArea')} value={fmt(d.professionalArea, t)} />
          <Field label={t('users.fieldCleanliness')} value={scale(d.cleanlinessLevel)} />
          <Field label={t('users.fieldNoise')} value={scale(d.noiseLevel)} />
          <Field label={t('users.fieldSleepSchedule')} value={scale(d.sleepSchedule)} />
          <Field label={t('users.fieldSociability')} value={scale(d.sociability)} />
          <Field label={t('users.fieldGuests')} value={scale(d.guests)} />
          <Field label={t('users.fieldSmoker')} value={fmt(asBool(d.isSmoker), t)} />
          <Field label={t('users.fieldHasPets')} value={fmt(asBool(d.hasPets), t)} />
          <Field label={t('users.fieldCooksOften')} value={fmt(asBool(d.cooksOften), t)} />
          <Field label={t('users.fieldBio')} value={fmt(d.description, t)} wide />
        </Section>
      )}

      {kind === 'landlord' && (
        <Section title={t('users.sectionLandlord')}>
          <Field label={t('users.fieldOwnerType')} value={ownerType === 'b2b' ? t('users.ownerTypeB2b') : t('users.ownerTypeB2c')} />
          <Field label={t('users.fieldCompanyName')} value={fmt(d.companyName, t)} />
          <Field label="VAT (Partita IVA)" value={fmt(d.vatNumber, t)} mono />
          <Field label="PEC" value={fmt(d.pec, t)} />
          <Field label={t('users.fieldProperties')} value={fmt(housesOwned, t)} />
          <Field
            label={t('users.fieldB2bApproval')}
            value={fmt(d.b2bApprovalStatus, t)}
          />
        </Section>
      )}

      <Section title={t('users.sectionVerification')}>
        <Field label={t('users.fieldIdentityVerification')} value={fmt(d.identityVerificationStatus, t)} />
        <Field label={t('users.fieldVerifiedTenant')} value={fmt(badges.verifiedTenant === true, t)} />
        <Field label={t('users.fieldVerifiedOwner')} value={fmt(badges.verifiedOwner === true, t)} />
        <Field label={t('users.fieldIdentityBadge')} value={fmt(badges.identityVerified === true, t)} />
        <Field
          label={t('users.fieldReviews')}
          value={fmt(
            typeof reputation.reviewCount === 'number'
              ? reputation.reviewCount
              : (d.numeroRecensioni ?? 0),
            t
          )}
        />
        <Field
          label={t('users.fieldAverageRating')}
          value={fmt(
            typeof reputation.averageRating === 'number'
              ? reputation.averageRating
              : (d.mediaRecensioni ?? null),
            t
          )}
        />
      </Section>

      <Section title="Stripe">
        <Field label={t('users.fieldCustomerId')} value={fmt(d.stripeCustomerId, t)} mono />
        <Field
          label={t('users.fieldConnectAccountId')}
          value={fmt(d.stripeConnectAccountId, t)}
          mono
        />
        <Field
          label={t('users.fieldConnectChargesEnabled')}
          value={fmt(d.connectChargesEnabled === true, t)}
        />
        <Field
          label={t('users.fieldOwnerSubscription')}
          value={fmt(sub ? (sub.status ?? 'unknown') : 'none', t)}
        />
        <Field
          label={t('users.fieldSubscriptionId')}
          value={fmt(sub ? sub.stripeSubscriptionId : null, t)}
          mono
        />
      </Section>

      {status !== 'active' && (
        <Section title={t('users.sectionAccountStatus')}>
          {status === 'suspended' && (
            <>
              <Field
                label={t('users.fieldSuspended')}
                value={fmt(tsToDate(d.suspended?.suspendedAt), t)}
              />
              <Field label={t('users.fieldReason')} value={fmt(d.suspended?.reason, t)} wide />
            </>
          )}
          {status === 'archived' && (
            <>
              <Field label={t('users.fieldArchived')} value={fmt(tsToDate(d.deletedAt), t)} />
              <Field label={t('users.fieldReason')} value={fmt(d.deletionReason, t)} wide />
            </>
          )}
        </Section>
      )}

      {d.managedBy && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="text-foreground">
            {t('users.managedAccountInfo')}
          </p>
          <Link
            href={`/managed/${uid}/operate`}
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            {t('users.openActiveManagement')}
          </Link>
        </section>
      )}

      <BlocksPanel
        blocked={Array.isArray(d.blockedUserIds) ? (d.blockedUserIds as string[]) : []}
        blockedBy={
          Array.isArray(d.blockedByUserIds) ? (d.blockedByUserIds as string[]) : []
        }
        t={t}
      />


      {/* Raw documents — guarantees nothing is hidden from the admin. */}
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground">
          {t('users.rawDocuments')}
        </summary>
        <div className="space-y-4 border-t border-border p-5">
          <RawBlock title={`users/${uid}`} data={d} docNotExist={t('users.docNotExist')} />
          <RawBlock
            title={`userProfiles/${uid}`}
            data={profileSnap.exists ? profile : null}
            docNotExist={t('users.docNotExist')}
          />
        </div>
      </details>
    </div>
  );
}

function scale(v: unknown): string {
  return typeof v === 'number' ? `${v} / 5` : '—';
}
function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {children}
      </dl>
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

function RawBlock({
  title,
  data,
  docNotExist,
}: {
  title: string;
  data: Record<string, unknown> | null;
  docNotExist: string;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-xs text-muted-foreground">{title}</p>
      {data ? (
        <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs text-foreground">
          {JSON.stringify(data, rawReplacer, 2)}
        </pre>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {docNotExist}
        </p>
      )}
    </div>
  );
}
