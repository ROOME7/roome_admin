// /connect/return — Stripe Connect onboarding return landing page.
//
// PUBLIC (no auth). Stripe redirects the partner here after they finish
// (or attempt to finish) the hosted KYC flow. Whether they succeeded is
// determined by Stripe's `account.updated` webhook — not by any signal in
// this redirect, which can fire on partial / abandoned flows too.
//
// What we do here: render a friendly "you can close this tab" page. The
// admin sees status via the webhook → users/{uid}.connectChargesEnabled
// mirror. No state changes happen on this page.
//
// Linked from STRIPE_CONNECT_RETURN_URL in actions.ts:triggerConnectOnboarding.

import Link from 'next/link';
import { readAdminSessionOrNull } from '@/lib/auth';

export default async function ConnectReturnPage() {
  // If this is the admin co-pilot scenario (admin completed onboarding
  // alongside the partner on the admin's machine), they're signed in and
  // we offer a "return to admin" link. If it's the partner on their phone,
  // they see the friendly close-this-tab copy.
  const session = await readAdminSessionOrNull();

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
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
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Onboarding submitted
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — Stripe has received your information. Account verification
          can take a few minutes to a few business days; you&apos;ll see your
          status update inside RooMe once it&apos;s ready.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          You can safely close this tab now.
        </p>

        {session && (
          <Link
            href="/managed"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
          >
            Return to admin panel
          </Link>
        )}
      </div>
    </main>
  );
}
