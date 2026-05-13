'use server';

// Server Actions for the Supervision (B2B approval) flow.
//
// SECURITY MODEL (read carefully before editing):
//   1. Every action re-verifies the admin session via requireAdminSession().
//      The (protected)/layout already does this on page load, but Server
//      Actions are a separate entry point that the browser can theoretically
//      call directly with a forged FormData. So we re-check.
//   2. Inputs come from FormData — bind() pre-fills the requestId server-side
//      so the client cannot tamper with which doc it's acting on.
//   3. All writes go through firebase-admin, which bypasses Firestore Rules.
//      That's exactly why we re-verify in step (1) — the security boundary
//      is the Next.js server, not the Firestore Rules.
//   4. Pre-flight checks: the request must exist and still be 'pending'.
//      We refuse anything else with a clear error.
//   5. Atomic batch: b2bOwnerRequests + users mirror update + Auth custom
//      claim are all bound together. If the claim update fails we log it but
//      don't roll back the doc writes (matches the existing Cloud Function
//      behavior; a follow-up reconciliation job can sync claims if needed).
//   6. revalidatePath at the end so the list re-fetches with the new state.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireAdminSession } from '@/lib/auth';
import { serverAuth, serverDb } from '@/lib/firebase-admin';

const MAX_NOTES_LENGTH = 2_000;

type ActionResult = { ok: true } | { ok: false; error: string };

function clampString(input: FormDataEntryValue | null, max: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

async function setB2bDecision(
  requestId: string,
  decision: 'approved' | 'rejected',
  notes: string | null,
  adminUid: string
): Promise<ActionResult> {
  if (!requestId || typeof requestId !== 'string') {
    return { ok: false, error: 'Missing request id.' };
  }

  const db = serverDb();
  const auth = serverAuth();
  const requestRef = db.collection('b2bOwnerRequests').doc(requestId);

  // Read first to validate state. This read also asserts the doc exists.
  const snap = await requestRef.get();
  if (!snap.exists) {
    return { ok: false, error: 'Request not found.' };
  }
  const data = snap.data() ?? {};
  if (data.status !== 'pending') {
    return {
      ok: false,
      error: `Request is already ${String(data.status)}; nothing to do.`,
    };
  }
  const ownerUid = data.ownerUid as string | undefined;
  if (!ownerUid) {
    return { ok: false, error: 'Request is malformed (missing ownerUid).' };
  }

  // Atomic mirror: b2bOwnerRequests + users/{ownerUid}. We don't include the
  // Auth claim update in the batch because that lives outside Firestore — we
  // call it after the commit succeeds.
  const now = Timestamp.now();
  const batch = db.batch();

  batch.update(requestRef, {
    status: decision,
    notes: notes ?? null,
    reviewedByAdminUid: adminUid,
    reviewedAt: now,
  });

  batch.set(
    db.collection('users').doc(ownerUid),
    {
      b2bApprovalStatus: decision,
      b2bApprovedAt: decision === 'approved' ? now : null,
      b2bApprovedByAdminUid: decision === 'approved' ? adminUid : null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  // Mirror b2bApproved onto custom claims so Firestore Rules + Flutter app
  // can gate listing creation on it. Preserve any other claims (roles etc.)
  // — never overwrite the whole claims object.
  try {
    const userRecord = await auth.getUser(ownerUid);
    const existingClaims = userRecord.customClaims ?? {};
    await auth.setCustomUserClaims(ownerUid, {
      ...existingClaims,
      b2bApproved: decision === 'approved',
    });
  } catch (err) {
    // Non-fatal — the doc + mirror already reflect the decision. A
    // periodic reconciler can re-sync claims if this fails. Log loudly.
    console.error(
      `[supervision] Failed to update b2bApproved claim for ${ownerUid}:`,
      err
    );
  }

  revalidatePath('/supervision');
  return { ok: true };
}

export async function approveB2bRequest(
  requestId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const notes = clampString(formData.get('notes'), MAX_NOTES_LENGTH) || null;
  return setB2bDecision(requestId, 'approved', notes, session.uid);
}

export async function rejectB2bRequest(
  requestId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminSession();
  // Rejection reason is mandatory — surface it in the request log so the
  // owner (and any future support escalations) know WHY they were rejected.
  const reason = clampString(formData.get('reason'), MAX_NOTES_LENGTH);
  if (reason.length < 3) {
    return {
      ok: false,
      error: 'Please provide a rejection reason (3+ characters).',
    };
  }
  return setB2bDecision(requestId, 'rejected', reason, session.uid);
}
