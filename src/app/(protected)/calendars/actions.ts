'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed, ApiCallError, AuthRequiredError } from '@/lib/session';

export interface SyncResult {
  ok: boolean;
  synced?: number;
  unchanged?: number;
  failed?: number;
  error?: string;
}

/**
 * Run the calendar sweep now.
 *
 * The same job the scheduler runs at 05:00. Worth having on a button because
 * straight after an import the rooms exist and nothing has pulled their
 * calendars yet — waiting until tomorrow means showing availability nobody has
 * checked.
 */
export async function syncCalendars(): Promise<SyncResult> {
  await requireAdminSession();
  try {
    const res = await apiAuthed<{ synced: number; unchanged: number; failed: number }>(
      '/admin/calendars/sync',
      { method: 'POST' },
    );
    revalidatePath('/calendars');
    return { ok: true, synced: res?.synced ?? 0, unchanged: res?.unchanged ?? 0, failed: res?.failed ?? 0 };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    if (err instanceof ApiCallError) return { ok: false, error: err.message };
    throw err;
  }
}
