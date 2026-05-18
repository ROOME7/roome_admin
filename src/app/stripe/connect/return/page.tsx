// /stripe/connect/return — Stripe Connect onboarding return landing.
//
// PUBLIC. Stripe redirects the partner here after they finish (or attempt
// to finish) the hosted KYC flow. Success/failure is determined by the
// account.updated webhook, not by any signal in this redirect — partial
// or abandoned onboarding fires here too.
//
// Linked from STRIPE_CONNECT_RETURN_URL in
// managed/actions.ts:triggerConnectOnboarding AND from the backend
// Cloud Functions' createConnectOnboardingLink (partner-self-triggered).

import { readAdminSessionOrNull } from '@/lib/auth';
import { CheckIcon, LandingCard } from '../../_components/landing-card';

export default async function ConnectReturnPage() {
  const session = await readAdminSessionOrNull();

  return (
    <LandingCard
      tone="success"
      icon={<CheckIcon />}
      title="Onboarding submitted"
      body={
        <>
          <p>
            Thanks — Stripe has received your information. Verification can
            take a few minutes to a few business days; you&apos;ll see your
            status update inside Roome once it&apos;s ready.
          </p>
          <p>You can safely close this tab now.</p>
        </>
      }
      cta={session ? { href: '/managed', label: 'Return to admin panel' } : null}
    />
  );
}
