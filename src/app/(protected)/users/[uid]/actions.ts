'use server';

// Server Actions for one account.
//
// SECURITY MODEL, the same as the property directory:
//   1. Every action re-verifies the admin session. A Server Action is its own
//      entry point and the (protected)/layout gate does not cover it.
//   2. THE REAL BOUNDARY IS THE API. This holds an admin's bearer token;
//      `POST /admin/users/:id/subscription-waiver` re-checks the role, and
//      Postgres re-checks it again because the API queries as the admin
//      rather than as a service.
//   3. revalidatePath so the page shows what just happened.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError } from '@/lib/session';

export type WaiverResult = { ok: true } | { ok: false; error: string };

/** The API's own codes, in words an admin can act on. */
function describe(err: unknown): string {
  if (err instanceof ApiCallError) {
    if (err.status === 404) return 'That account no longer exists.';
    if (err.message.includes('waiver_requires_landlord')) {
      return 'Only a landlord account can be comped — the paid gate does not apply to tenants.';
    }
    if (err.message.includes('waiver_reason_required')) {
      return 'Give a reason. It is stored on the account and in the audit trail.';
    }
    if (err.message.includes('waiver_expiry_in_past')) {
      return 'That end date has already passed.';
    }
    return err.message;
  }
  return 'Something went wrong. Nothing was changed.';
}

export async function setSubscriptionWaiver(
  userId: string,
  input: { waived: boolean; reason?: string; expiresAt?: string },
): Promise<WaiverResult> {
  await requireAdminSession();

  try {
    await apiAuthed(`/admin/users/${userId}/subscription-waiver`, {
      method: 'POST',
      body: JSON.stringify({
        waived: input.waived,
        // Sent only when granting. The API requires a reason to grant and
        // refuses one to withdraw, so passing an empty string either way
        // would fail validation on one of the two paths.
        ...(input.waived ? { reason: input.reason } : {}),
        // A date input gives `YYYY-MM-DD`; the API wants ISO 8601. End of
        // that day rather than its start, or "free until the 31st" expires
        // on the morning of the 31st.
        ...(input.waived && input.expiresAt
          ? { expiresAt: new Date(`${input.expiresAt}T23:59:59.999Z`).toISOString() }
          : {}),
      }),
    });
  } catch (err) {
    return { ok: false, error: describe(err) };
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  return { ok: true };
}
