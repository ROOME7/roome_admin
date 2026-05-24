// Admin action audit helper. Writes to `adminAccountActions/{actionId}`
// per Schema v2 §4.23. Server-only — every admin-initiated mutation in
// `(protected)/managed/actions.ts` (and adjacent server actions) should
// call this so we get a tamper-resistant trail.
//
// Distinct from `impersonationLog` (which logs sessions where the admin
// acts AS the partner). This logs admin acting ON the partner from the
// admin surface.

import 'server-only';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
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
  | 'revoke_admin'
  | 'report_take_over'
  | 'report_resolve'
  | 'report_dismiss';

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

// ---------------------------------------------------------------------------
// Read helpers (T5 — portfolio + activity timelines)
// ---------------------------------------------------------------------------

// AdminActionEntry + formatAdminAction live in audit-format.ts (client-
// safe, no firebase-admin) so dialogs and Server Components can both
// import them without pulling Node-only deps.
//
// The read helpers below stay here because they hit firebase-admin and
// can only run server-side.

import type { AdminActionEntry } from './audit-format';
export type { AdminActionEntry } from './audit-format';

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function mapEntry(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): AdminActionEntry {
  const d = doc.data();
  return {
    id: doc.id,
    adminUid: typeof d.adminUid === 'string' ? d.adminUid : '',
    targetUid: typeof d.targetUid === 'string' ? d.targetUid : '',
    action: typeof d.action === 'string' ? d.action : 'unknown',
    payload:
      d.payload && typeof d.payload === 'object'
        ? (d.payload as Record<string, unknown>)
        : {},
    at: tsToDate(d.at),
  };
}

/**
 * Most recent admin actions across ALL accounts — feeds the dashboard
 * Recent activity panel.
 */
export async function getRecentAdminActions(
  limit = 20
): Promise<AdminActionEntry[]> {
  const db = serverDb();
  const snap = await db
    .collection('adminAccountActions')
    .orderBy('at', 'desc')
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();
  return snap.docs.map(mapEntry);
}

/**
 * Admin actions scoped to a single account — feeds the per-account
 * Activity dialog (T5 Item 17).
 *
 * Note: the canonical query is .where('targetUid', '==', uid).orderBy('at',
 * 'desc') which needs a composite index. The index is pre-staged in
 * firestore.indexes.json. Until it's deployed, we use only the where
 * clause and sort in memory — same pattern as the operate-page chats fix.
 */
export async function getAccountActivity(
  targetUid: string,
  limit = 50
): Promise<AdminActionEntry[]> {
  if (!targetUid) return [];
  const db = serverDb();
  const snap = await db
    .collection('adminAccountActions')
    .where('targetUid', '==', targetUid)
    .limit(Math.max(1, Math.min(limit, 200)))
    .get();
  const out = snap.docs.map(mapEntry);
  out.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  return out;
}

