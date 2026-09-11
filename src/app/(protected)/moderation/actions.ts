'use server';

// Server Actions for the UGC Moderation flow (App Store guideline 1.2).
//
// SECURITY MODEL:
//   1. Every action re-verifies the admin session via requireAdminSession().
//      Server Actions are a separate entry point from the page, so the
//      (protected)/layout gate does not cover them.
//   2. reportId is bound server-side via .bind() in the parent, so a client
//      cannot retarget the action.
//   3. THE REAL BOUNDARY IS THE API. These actions hold an admin's bearer
//      token and `PATCH /admin/reports/:id` re-checks the role. When this file
//      talked to Firestore through firebase-admin it bypassed every rule, and
//      the session check here was the only thing standing between a visitor
//      and the whole database.
//   4. revalidatePath so the list and the detail page both refresh.
//
// ⚠️ THE TRANSITION GUARD AND THE AUDIT ROW MOVED TO THE SERVER. This file
// used to read the report, decide whether the transition was legal, write it,
// and then write its own audit row — four round trips that another moderator
// could interleave with. The API does it in one.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError, AuthRequiredError } from '@/lib/session';
import { statusToApi } from './_lib/format';
import type { ReportStatus } from './_lib/types';

const MAX_RESOLUTION_LENGTH = 1_000;

type ActionResult = { ok: true } | { ok: false; error: string };

function clampString(input: FormDataEntryValue | null, max: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

async function transitionReport(
  reportId: string,
  next: Exclude<ReportStatus, 'open'>,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdminSession();
  if (!reportId) return { ok: false, error: 'Missing report id.' };

  const resolution = clampString(formData.get('actionTaken'), MAX_RESOLUTION_LENGTH);

  try {
    await apiAuthed(`/admin/reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: statusToApi(next),
        // Omit rather than send an empty string: the field is optional and
        // `""` would overwrite a note a colleague left a minute ago.
        ...(resolution ? { resolution } : {}),
      }),
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    if (err instanceof ApiCallError) {
      return {
        ok: false,
        error: err.status === 404 ? 'Report not found.' : err.message,
      };
    }
    throw err;
  }

  revalidatePath('/moderation');
  revalidatePath(`/moderation/${reportId}`);
  return { ok: true };
}

export async function markReportReviewing(
  reportId: string,
  formData: FormData,
): Promise<ActionResult> {
  return transitionReport(reportId, 'reviewing', formData);
}

export async function resolveReport(
  reportId: string,
  formData: FormData,
): Promise<ActionResult> {
  return transitionReport(reportId, 'resolved', formData);
}

export async function dismissReport(
  reportId: string,
  formData: FormData,
): Promise<ActionResult> {
  // No reason required — dismissals are mostly false positives, and demanding
  // a justification for each one slows the queue for no gain.
  return transitionReport(reportId, 'dismissed', formData);
}
