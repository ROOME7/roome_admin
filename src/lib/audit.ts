// Admin action audit helper. Writes to `adminAccountActions/{actionId}`
// per Schema v2 §4.23. Server-only — every admin-initiated mutation in
// `(protected)/managed/actions.ts` (and adjacent server actions) should
// call this so we get a tamper-resistant trail.
//
// Distinct from `impersonationLog` (which logs sessions where the admin
// acts AS the partner). This logs admin acting ON the partner from the
// admin surface.

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { serverDb } from './firebase-admin';

export type AdminAction =
  | 'set_note'
  | 'set_tags'
  | 'edit_profile'
  | 'suspend'
  | 'reactivate'
  | 'archive'
  | 'reclaim'
  | 'set_waiver'
  | 'refund'
  | 'notify'
  | 'trigger_connect_onboarding'
  | 'grant_admin'
  | 'revoke_admin';

export interface RecordAdminActionInput {
  adminUid: string;
  targetUid: string;
  action: AdminAction;
  payload?: Record<string, unknown>;
}

/**
 * Append an admin-action entry. Fire-and-forget at the call site is fine —
 * audit failure shouldn't block the user-visible mutation since the doc
 * write that triggered the action is the source of truth. Caller may
 * `await` if it wants delivery confirmation.
 */
export async function recordAdminAction(
  input: RecordAdminActionInput
): Promise<void> {
  const db = serverDb();
  try {
    await db.collection('adminAccountActions').add({
      adminUid: input.adminUid,
      targetUid: input.targetUid,
      action: input.action,
      payload: input.payload ?? {},
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal: log + move on. The action that triggered this audit
    // entry has its own user-visible doc change as the source of truth.
    console.error('[audit] recordAdminAction failed:', err);
  }
}
