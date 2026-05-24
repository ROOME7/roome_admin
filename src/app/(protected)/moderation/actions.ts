'use server';

// Server Actions for the UGC Moderation flow (App Store guideline 1.2).
//
// SECURITY MODEL (mirror of supervision/actions.ts):
//   1. Every action re-verifies the admin session via requireAdminSession().
//      Server Actions are a separate entry point from the page server-
//      component so we cannot rely on (protected)/layout's gate alone.
//   2. reportId is bound server-side via .bind() in the parent so a malicious
//      client cannot retarget the action.
//   3. firebase-admin bypasses Firestore rules — the security boundary IS the
//      admin-session check in step (1).
//   4. Pre-flight: the report must exist. Transitions are validated against
//      the current status so concurrent reviewers don't double-act.
//   5. Audit: each successful action writes to `adminAccountActions` via
//      recordAdminAction (Schema v2 §4.23) — `targetUid` is the reported
//      account's owner so the per-user activity dialog surfaces it.
//   6. revalidatePath at the end so the list + detail page refresh.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAdminSession } from '@/lib/auth';
import { serverDb } from '@/lib/firebase-admin';
import { recordAdminAction, type AdminAction } from '@/lib/audit';

const MAX_ACTION_TAKEN_LENGTH = 2_000;

type ActionResult = { ok: true } | { ok: false; error: string };

function clampString(input: FormDataEntryValue | null, max: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

interface TransitionInput {
  reportId: string;
  next: 'reviewing' | 'resolved' | 'dismissed';
  /** Allowed prior statuses for the transition. */
  from: ReadonlyArray<'open' | 'reviewing'>;
  /** Free-text note recorded alongside the action. */
  actionTaken: string | null;
  adminUid: string;
  auditAction: AdminAction;
}

async function transitionReport({
  reportId,
  next,
  from,
  actionTaken,
  adminUid,
  auditAction,
}: TransitionInput): Promise<ActionResult> {
  if (!reportId || typeof reportId !== 'string') {
    return { ok: false, error: 'Missing report id.' };
  }

  const db = serverDb();
  const reportRef = db.collection('reports').doc(reportId);

  const snap = await reportRef.get();
  if (!snap.exists) {
    return { ok: false, error: 'Report not found.' };
  }
  const data = snap.data() ?? {};
  const current = typeof data.status === 'string' ? data.status : 'open';
  if (!from.includes(current as 'open' | 'reviewing')) {
    return {
      ok: false,
      error: `Report is ${current}; cannot transition to ${next}.`,
    };
  }

  // For terminal states (resolved / dismissed) stamp the resolution
  // metadata. For 'reviewing' we leave resolvedAt null so the queue can
  // distinguish "claimed but not done" from "finished".
  const isTerminal = next === 'resolved' || next === 'dismissed';
  await reportRef.update({
    status: next,
    actionTaken: actionTaken ?? null,
    resolvedByAdminUid: isTerminal ? adminUid : data.resolvedByAdminUid ?? null,
    resolvedAt: isTerminal ? Timestamp.now() : data.resolvedAt ?? null,
  });

  // Audit. targetUid is the reported account owner so the per-user
  // activity dialog surfaces moderation history alongside other admin
  // actions. Falls back to the reporter if owner is unknown.
  const targetUid =
    typeof data.targetOwnerUid === 'string' && data.targetOwnerUid.length > 0
      ? data.targetOwnerUid
      : typeof data.reporterUid === 'string'
        ? data.reporterUid
        : '';
  await recordAdminAction({
    adminUid,
    targetUid,
    action: auditAction,
    payload: {
      reportId,
      reason: typeof data.reason === 'string' ? data.reason : null,
      targetType: typeof data.targetType === 'string' ? data.targetType : null,
      actionTaken,
    },
  });

  revalidatePath('/moderation');
  revalidatePath(`/moderation/${reportId}`);
  return { ok: true };
}

export async function markReportReviewing(
  reportId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const actionTaken =
    clampString(formData.get('actionTaken'), MAX_ACTION_TAKEN_LENGTH) || null;
  return transitionReport({
    reportId,
    next: 'reviewing',
    from: ['open'],
    actionTaken,
    adminUid: session.uid,
    auditAction: 'report_take_over',
  });
}

export async function resolveReport(
  reportId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const actionTaken =
    clampString(formData.get('actionTaken'), MAX_ACTION_TAKEN_LENGTH) || null;
  return transitionReport({
    reportId,
    next: 'resolved',
    from: ['open', 'reviewing'],
    actionTaken,
    adminUid: session.uid,
    auditAction: 'report_resolve',
  });
}

export async function dismissReport(
  reportId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminSession();
  // Reason text is optional — dismissals are common (false positives) and
  // forcing a reason would slow the queue. Optional notes can ride on the
  // actionTaken field for context.
  const actionTaken =
    clampString(formData.get('actionTaken'), MAX_ACTION_TAKEN_LENGTH) || null;
  return transitionReport({
    reportId,
    next: 'dismissed',
    from: ['open', 'reviewing'],
    actionTaken,
    adminUid: session.uid,
    auditAction: 'report_dismiss',
  });
}
