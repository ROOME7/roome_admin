// /stripe/subscription/cancel — Stripe Checkout cancel landing.
//
// PUBLIC (no admin auth). Stripe Checkout redirects here when the
// owner closes the Checkout sheet without completing payment. No
// state changes — listing stays in status='awaiting_payment' and
// the partner can re-trigger the paywall any time from the Flutter
// app.

import { readAdminSessionOrNull } from '@/lib/auth';
import { LandingCard, PauseIcon } from '../../_components/landing-card';

export default async function SubscriptionCancelPage() {
  const session = await readAdminSessionOrNull();

  return (
    <LandingCard
      tone="neutral"
      icon={<PauseIcon />}
      title="Payment not completed"
      body={
        <>
          <p>
            You closed Stripe Checkout without paying. Your listing is still
            in <code className="rounded bg-muted px-1 py-0.5 text-xs">awaiting_payment</code>{' '}
            and won&apos;t be published until the €150 subscription is paid.
          </p>
          <p>
            Reopen Roome and try again from your listing — no data was lost.
          </p>
        </>
      }
      cta={session ? { href: '/managed', label: 'Return to admin panel' } : null}
    />
  );
}
