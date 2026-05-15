// Lazy Stripe client for server-side admin actions.
//
// Same shape as serverDb / serverAuth / serverStorage — single module-level
// instance, instantiated on first call so build-time imports don't crash
// when STRIPE_SECRET_KEY is unset (e.g. on CI runners without secrets).
//
// Used by:
//   - archiveManagedAccount → cancel sub on archive (admin-panel-roadmap T2.5)
//   - refundOwnerSubInvoice → platform-side refunds (T4 Item 13)
//   - triggerConnectOnboarding → create acct + onboarding link (T4 Item 12)

import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function serverStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY env var is missing. See .env.example.'
    );
  }
  _stripe = new Stripe(key, {
    // Match the backend's pinned version when one is set. As of writing,
    // Stripe-Node 17 negotiates the latest API by default; pin once the
    // backend pins.
    typescript: true,
  });
  return _stripe;
}
