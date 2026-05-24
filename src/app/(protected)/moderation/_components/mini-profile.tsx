// Compact "user mini-profile" card used by the report detail page.
// Renders the user's avatar (when available), display name, and email
// next to a link into /users/[uid] for the full admin view. Hidden when
// the uid is null/empty — caller decides whether to show a fallback.

import 'server-only';
import Link from 'next/link';
import Image from 'next/image';
import { serverDb } from '@/lib/firebase-admin';

interface Resolved {
  displayName: string;
  email: string | null;
  photoUrl: string | null;
}

async function resolveUser(uid: string): Promise<Resolved> {
  const db = serverDb();
  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('userProfiles').doc(uid).get(),
  ]);
  const u = userSnap.data() ?? {};
  const p = profileSnap.data() ?? {};
  const displayName =
    (typeof u.fullName === 'string' && u.fullName) ||
    [u.name, u.surname].filter((x) => typeof x === 'string' && x).join(' ') ||
    (typeof p.displayUsername === 'string' && p.displayUsername) ||
    (typeof p.username === 'string' && p.username) ||
    (typeof u.companyName === 'string' && u.companyName) ||
    uid;
  const email = typeof u.email === 'string' ? u.email : null;
  const photoUrl =
    (typeof p.photoUrl === 'string' && p.photoUrl) ||
    (typeof u.profilePicture === 'string' && u.profilePicture) ||
    null;
  return { displayName, email, photoUrl };
}

export async function MiniProfile({
  uid,
  label,
  fallback,
}: {
  uid: string | null;
  label: string;
  /** Shown when uid is null — e.g. "Reporter unknown". */
  fallback: string;
}) {
  if (!uid) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{fallback}</p>
      </section>
    );
  }

  const { displayName, email, photoUrl } = await resolveUser(uid);

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar url={photoUrl} alt={displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          {email && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {uid}
          </p>
        </div>
        <Link
          href={`/users/${uid}`}
          className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          /users/{uid.slice(0, 6)}…
        </Link>
      </div>
    </section>
  );
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        {alt.charAt(0).toUpperCase() || '?'}
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-full object-cover"
      unoptimized
    />
  );
}
