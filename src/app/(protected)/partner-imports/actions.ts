'use server';

// Server Actions for partner imports.
//
// ⚠️ THE FILE PASSES THROUGH, IT IS NOT STORED. The browser holds the upload,
// this forwards it to the API, and the API keeps the parsed plan rather than
// the spreadsheet. That is what lets a corrected mapping be re-read without
// asking anybody to find the file again, and what keeps partner data off our
// disks.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError, AuthRequiredError, getAccessToken } from '@/lib/session';
import { apiBaseUrl } from '@/lib/api';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function fail(err: unknown): ActionResult<never> {
  if (err instanceof ApiCallError) return { ok: false, error: err.message };
  return { ok: false, error: 'Something went wrong. Try again.' };
}

/**
 * Upload a sheet and get back what importing it would do.
 *
 * Sent as multipart straight through: `apiAuthed` serialises JSON, and this is
 * the one call that carries a file.
 */
export async function previewImport(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdminSession();
  const token = await getAccessToken();
  if (!token) throw new AuthRequiredError();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a spreadsheet to upload.' };
  }

  const outbound = new FormData();
  // ⚠️ THE FILE GOES LAST. Fastify's multipart parser streams in order and
  // only exposes the fields it has already passed, so anything sent after the
  // file is invisible to the handler.
  outbound.set('ownerId', String(formData.get('ownerId') ?? ''));
  const profileId = String(formData.get('profileId') ?? '');
  if (profileId) outbound.set('profileId', profileId);
  const profile = String(formData.get('profile') ?? '');
  if (profile) outbound.set('profile', profile);
  outbound.set('file', file, file.name);

  const res = await fetch(`${apiBaseUrl()}/admin/partner-imports/preview`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'it' },
    body: outbound,
    cache: 'no-store',
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    return { ok: false, error: body?.error?.message ?? `Upload failed (${res.status}).` };
  }

  revalidatePath('/partner-imports');
  return { ok: true, data: body };
}

export async function commitImport(id: string): Promise<ActionResult<unknown>> {
  await requireAdminSession();
  try {
    const data = await apiAuthed(`/admin/partner-imports/${encodeURIComponent(id)}/commit`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revalidatePath('/partner-imports');
    revalidatePath(`/partner-imports/${id}`);
    revalidatePath('/calendars');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return fail(err);
  }
}

export async function discardImport(id: string): Promise<ActionResult> {
  await requireAdminSession();
  try {
    await apiAuthed(`/admin/partner-imports/${encodeURIComponent(id)}`, { method: 'DELETE' });
    revalidatePath('/partner-imports');
    revalidatePath(`/partner-imports/${id}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return fail(err);
  }
}

export async function saveMapping(input: {
  ownerId: string;
  name: string;
  spec: unknown;
  headerHash?: string;
}): Promise<ActionResult> {
  await requireAdminSession();
  try {
    await apiAuthed('/admin/partner-imports/profiles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/partner-imports');
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return fail(err);
  }
}
