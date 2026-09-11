'use server';

// Server Actions for the Supervision (B2B approval) flow.
//
// SECURITY MODEL:
//   1. Every action re-verifies the admin session. The (protected) layout
//      gates the page, but a Server Action is a separate entry point.
//   2. requestId is bound server-side via .bind(), so the client cannot
//      retarget which application it is deciding.
//   3. THE REAL BOUNDARY IS THE API, which re-checks the role. When this file
//      wrote through firebase-admin it bypassed every rule, and the session
//      check here was all that stood between a visitor and the database.
//
// ⚠️ ONE WRITE, NOT FOUR. Approving used to update the request document,
// mirror `b2bApprovalStatus` onto the user, and set a Firebase custom claim —
// three stores that disagreed in production (twelve accounts carried the claim
// while four request records said approved). The API writes one row, audits it
// in the same transaction, emails the applicant, and on a rejection revokes
// their sessions immediately — none of which this file could do.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError, AuthRequiredError } from '@/lib/session';

const MAX_NOTES_LENGTH = 2_000;

type ActionResult = { ok: true } | { ok: false; error: string };

function clampString(input: FormDataEntryValue | null, max: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

async function decide(
  requestId: string,
  decision: 'approve' | 'reject',
  notes: string | null,
): Promise<ActionResult> {
  if (!requestId) return { ok: false, error: 'Missing request id.' };

  try {
    await apiAuthed(`/admin/b2b-requests/${encodeURIComponent(requestId)}/${decision}`, {
      method: 'POST',
      body: JSON.stringify(notes ? { notes } : {}),
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    if (err instanceof ApiCallError) {
      // `b2b_already_decided` is the one worth its own line: it means a
      // colleague got there first, not that anything went wrong.
      return { ok: false, error: err.message };
    }
    throw err;
  }

  revalidatePath('/supervision');
  return { ok: true };
}

export async function approveB2bRequest(
  requestId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();
  const notes = clampString(formData.get('notes'), MAX_NOTES_LENGTH) || null;
  return decide(requestId, 'approve', notes);
}

export async function rejectB2bRequest(
  requestId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();
  // The applicant is shown this text verbatim, so a bare rejection is not
  // useful to them. The API refuses one too; this says so without a round
  // trip.
  const reason = clampString(formData.get('reason'), MAX_NOTES_LENGTH);
  if (reason.length < 3) {
    return { ok: false, error: 'Please provide a rejection reason (3+ characters).' };
  }
  return decide(requestId, 'reject', reason);
}
