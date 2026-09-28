'use server';

// Server Actions for the property directory.
//
// SECURITY MODEL, unchanged from the moderation flow:
//   1. Every action re-verifies the admin session. A Server Action is a
//      separate entry point from the page, so the (protected)/layout gate does
//      not cover it.
//   2. THE REAL BOUNDARY IS THE API. These hold an admin's bearer token and
//      `DELETE /admin/properties/:id` re-checks the role — and then Postgres
//      re-checks it again, because the API queries as the admin rather than as
//      a service. Three layers, none of them this file.
//   3. revalidatePath so the table reflects what just happened.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError, AuthRequiredError } from '@/lib/session';

/** Mirrors the API's cap. Kept in sync by hand; the API rejects anything over. */
const BULK_DELETE_MAX = 50;

export type DeleteResult =
  | { ok: true; deleted: number; alreadyDeleted: number }
  | { ok: false; error: string };

export type RestoreResult = { ok: true } | { ok: false; error: string };

function describe(err: unknown): string {
  if (err instanceof ApiCallError) {
    return err.status === 404 ? 'That listing no longer exists.' : err.message;
  }
  return 'Something went wrong. Nothing was deleted.';
}

export async function deleteProperties(ids: string[]): Promise<DeleteResult> {
  await requireAdminSession();

  // Defence in depth: the table should never send these, but an action is a
  // public entry point and the cheap checks belong on both sides.
  const clean = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id)));
  if (clean.length === 0) return { ok: false, error: 'Nothing was selected.' };
  if (clean.length > BULK_DELETE_MAX) {
    return { ok: false, error: `Select at most ${BULK_DELETE_MAX} listings at a time.` };
  }

  try {
    // One path for one row and for fifty. A separate single-delete call would
    // be a second thing to keep correct for no gain — the API is idempotent
    // and reports per-id, so the bulk endpoint answers both cases.
    const res = await apiAuthed<{
      deleted: string[];
      alreadyDeleted: string[];
      notFound: string[];
    }>('/admin/properties/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: clean }),
    });
    if (!res) return { ok: false, error: 'No response from the server.' };

    revalidatePath('/listings');
    // The dashboard's "Active listings" tile counts these.
    revalidatePath('/');
    return {
      ok: true,
      deleted: res.deleted.length,
      // notFound folds into "already gone" on purpose: to the person looking
      // at the screen those are the same outcome, and splitting them invites
      // the question "which ones?" with no useful answer.
      alreadyDeleted: res.alreadyDeleted.length + res.notFound.length,
    };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return { ok: false, error: describe(err) };
  }
}

export async function restoreProperty(id: string): Promise<RestoreResult> {
  await requireAdminSession();
  if (!id) return { ok: false, error: 'Missing listing id.' };

  try {
    await apiAuthed(`/admin/properties/${encodeURIComponent(id)}/restore`, { method: 'POST' });
    revalidatePath('/listings');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return { ok: false, error: describe(err) };
  }
}
