// /stripe/subscription/success — Stripe Checkout success landing.
//
// PUBLIC (no admin auth required — partner is the typical visitor).
// Stripe Checkout redirects here after a successful €150 owner-sub
// payment with the real CheckoutSession id substituted for the
// {CHECKOUT_SESSION_ID} placeholder we set on session creation.
//
// State sync happens via the customer.subscription.created webhook —
// this page does NOT verify the session, write Firestore, or call
// Stripe. It just shows a friendly confirmation.

import { readAdminSessionOrNull } from '@/lib/auth';
import { CheckIcon, LandingCard } from '../../_components/landing-card';

type SearchParams = Promise<{ session_id?: string }>;

export default async function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const session = await readAdminSessionOrNull();

  return (
    <LandingCard
      tone="success"
      icon={<CheckIcon />}
      title="Subscription confirmed"
      body={
        <>
          <p>
            Thanks — your €150/year listing subscription is active. You can
            return to RooMe and publish your listing.
          </p>
          {sp.session_id && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Session: {sp.session_id.slice(0, 24)}…
            </p>
          )}
        </>
      }
      cta={session ? { href: '/managed', label: 'Return to admin panel' } : null}
    />
  );
}
