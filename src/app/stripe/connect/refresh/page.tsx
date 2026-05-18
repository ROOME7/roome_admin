// /stripe/connect/refresh — Stripe Connect Account Link refresh landing.
//
// PUBLIC. Stripe redirects the partner here if the Account Link expired
// before they finished onboarding (links are short-lived: minutes, not
// hours). We do NOT auto-mint a new link for unauthenticated visitors —
// that would let anyone hit this URL and spam Account Link creation.
//
// Admin-signed-in case: CTA to regenerate from /managed.
// Partner case (no session): "contact Roome support" — admin can issue a
// fresh link in seconds from the Connect dialog.

import { readAdminSessionOrNull } from '@/lib/auth';
import { AlertIcon, LandingCard } from '../../_components/landing-card';

export default async function ConnectRefreshPage() {
  const session = await readAdminSessionOrNull();

  return (
    <LandingCard
      tone="warning"
      icon={<AlertIcon />}
      title="Onboarding link expired"
      body={
        <>
          <p>
            The verification link Stripe issued has expired. Stripe&apos;s
            security policy keeps these short-lived for safety.
          </p>
          <p>
            Please contact Roome support to receive a fresh link, or retry
            from the Roome app where you started.
          </p>
        </>
      }
      cta={
        session
          ? { href: '/managed', label: 'Regenerate from admin panel' }
          : null
      }
    />
  );
}
