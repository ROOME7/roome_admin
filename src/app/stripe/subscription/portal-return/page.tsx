// /stripe/subscription/portal-return — Stripe Customer Portal return.
//
// PUBLIC (no admin auth). Stripe Customer Portal redirects here after
// the owner finishes managing their subscription (cancel / update
// payment method / view invoices). State sync happens via the
// customer.subscription.updated / customer.subscription.deleted
// webhooks — this page is purely informational.

import { readAdminSessionOrNull } from '@/lib/auth';
import { CheckIcon, LandingCard } from '../../_components/landing-card';

export default async function PortalReturnPage() {
  const session = await readAdminSessionOrNull();

  return (
    <LandingCard
      tone="neutral"
      icon={<CheckIcon />}
      title="Subscription settings updated"
      body={
        <>
          <p>
            Your changes have been saved. Any cancellation takes effect at the
            end of the current billing period; new payment methods apply to
            future renewals immediately.
          </p>
          <p>You can safely close this tab.</p>
        </>
      }
      cta={session ? { href: '/managed', label: 'Return to admin panel' } : null}
    />
  );
}
