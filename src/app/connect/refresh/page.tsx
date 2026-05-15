// /connect/refresh — Stripe Connect Account Link refresh landing.
//
// PUBLIC (no auth). Stripe redirects the partner here if the Account Link
// expired before they finished onboarding (links are short-lived, minutes
// not hours). The partner has no admin session, and we can't safely
// auto-mint a new link for an unauthenticated visitor (would let anyone
// generate Account Links by hitting this URL).
//
// So the v1 UX is: "your link expired, ping your RooMe admin." The admin
// can regenerate via the Connect dialog on /managed in seconds.
//
// Future improvement (T4 follow-up): if we sign the original link with a
// short-lived JWT containing the accountId, this page could verify the
// JWT + mint a fresh link without admin involvement. Not worth building
// for the volume of refresh events we expect.

import Link from 'next/link';
import { readAdminSessionOrNull } from '@/lib/auth';

export default async function ConnectRefreshPage() {
  const session = await readAdminSessionOrNull();

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-700"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Onboarding link expired
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The verification link Stripe issued has expired. Stripe&apos;s
          security policy keeps these short-lived. Please contact your RooMe
          admin to receive a fresh onboarding link.
        </p>

        {session && (
          <Link
            href="/managed"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
          >
            Regenerate from admin panel
          </Link>
        )}
      </div>
    </main>
  );
}
