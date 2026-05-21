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
import { classify, deriveStatus, roleLabel, tsToDate } from '../_lib/user-model';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
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

  return (
    <div className="space-y-8">
      <div className="text-sm text-muted-foreground">
        <Link href="/users" className="hover:text-foreground">
          ← Users
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
            {fmt(d.email)} · @{displayName.replace(/^@/, '')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{roleLabel(kind, ownerType)}</Badge>
            <Badge
              tone={
                status === 'active'
                  ? 'good'
                  : status === 'suspended'
                    ? 'warning'
                    : 'bad'
              }
            >
              {status}
            </Badge>
            {d.managedBy && <Badge tone="info">Managed account</Badge>}
          </div>
        </div>
      </header>

      <Section title="Identity & contact">
        <Field label="Full name" value={fullName} />
        <Field label="Username" value={displayName} />
        <Field label="Email" value={d.email} />
        <Field label="Email verified" value={d.emailVerified === true} />
        <Field label="Phone" value={d.phoneNumber} />
        <Field label="UID" value={uid} mono />
      </Section>

      <Section title="Account">
        <Field label="Role" value={roleLabel(kind, ownerType)} />
        <Field label="Profile completed" value={d.profileCompleted === true} />
        <Field label="Created" value={tsToDate(d.createdAt)} />
        <Field
          label="Last updated"
          value={tsToDate(d.updatedAt)}
        />
        <Field label="Auth provider" value={d.authProvider ?? 'password'} />
      </Section>

      {kind === 'tenant' && (
        <Section title="Tenant profile">
          <Field label="Age" value={d.age} />
          <Field label="Gender" value={d.gender} />
          <Field label="Profession" value={d.profession} />
          <Field label="Field / area" value={d.professionalArea} />
          <Field label="Cleanliness" value={scale(d.cleanlinessLevel)} />
          <Field label="Noise" value={scale(d.noiseLevel)} />
          <Field label="Sleep schedule" value={scale(d.sleepSchedule)} />
          <Field label="Sociability" value={scale(d.sociability)} />
          <Field label="Guests" value={scale(d.guests)} />
          <Field label="Smoker" value={asBool(d.isSmoker)} />
          <Field label="Has pets" value={asBool(d.hasPets)} />
          <Field label="Cooks often" value={asBool(d.cooksOften)} />
          <Field label="Bio" value={d.description} wide />
        </Section>
      )}

      {kind === 'landlord' && (
        <Section title="Landlord details">
          <Field label="Owner type" value={ownerType === 'b2b' ? 'B2B (agency / company)' : 'B2C (private)'} />
          <Field label="Company name" value={d.companyName} />
          <Field label="VAT (Partita IVA)" value={d.vatNumber} mono />
          <Field label="PEC" value={d.pec} />
          <Field label="Properties owned" value={housesOwned} />
          <Field
            label="B2B approval status"
            value={d.b2bApprovalStatus}
          />
        </Section>
      )}

      <Section title="Verification & reputation">
        <Field label="Identity verification" value={d.identityVerificationStatus} />
        <Field label="Verified tenant" value={badges.verifiedTenant === true} />
        <Field label="Verified owner" value={badges.verifiedOwner === true} />
        <Field label="Identity badge" value={badges.identityVerified === true} />
        <Field
          label="Reviews"
          value={
            typeof reputation.reviewCount === 'number'
              ? reputation.reviewCount
              : (d.numeroRecensioni ?? 0)
          }
        />
        <Field
          label="Average rating"
          value={
            typeof reputation.averageRating === 'number'
              ? reputation.averageRating
              : (d.mediaRecensioni ?? null)
          }
        />
      </Section>

      <Section title="Stripe">
        <Field label="Customer ID" value={d.stripeCustomerId} mono />
        <Field
          label="Connect account ID"
          value={d.stripeConnectAccountId}
          mono
        />
        <Field
          label="Connect charges enabled"
          value={d.connectChargesEnabled === true}
        />
        <Field
          label="Owner subscription"
          value={sub ? (sub.status ?? 'unknown') : 'none'}
        />
        <Field
          label="Subscription ID"
          value={sub ? sub.stripeSubscriptionId : null}
          mono
        />
      </Section>

      {status !== 'active' && (
        <Section title="Account status">
          {status === 'suspended' && (
            <>
              <Field
                label="Suspended"
                value={tsToDate(d.suspended?.suspendedAt)}
              />
              <Field label="Reason" value={d.suspended?.reason} wide />
            </>
          )}
          {status === 'archived' && (
            <>
              <Field label="Archived" value={tsToDate(d.deletedAt)} />
              <Field label="Reason" value={d.deletionReason} wide />
            </>
          )}
        </Section>
      )}

      {d.managedBy && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="text-foreground">
            This account is operated on the partner&apos;s behalf by an admin.
          </p>
          <Link
            href={`/managed/${uid}/operate`}
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            Open in Active Management →
          </Link>
        </section>
      )}

      {/* Raw documents — guarantees nothing is hidden from the admin. */}
      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground">
          Raw documents
        </summary>
        <div className="space-y-4 border-t border-border p-5">
          <RawBlock title={`users/${uid}`} data={d} />
          <RawBlock
            title={`userProfiles/${uid}`}
            data={profileSnap.exists ? profile : null}
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
        {fmt(value)}
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
}: {
  title: string;
  data: Record<string, unknown> | null;
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
          (document does not exist)
        </p>
      )}
    </div>
  );
}
