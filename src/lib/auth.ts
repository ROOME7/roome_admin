// Server-side auth — reads the Roome API session, not Firebase.
//
// Two layers, unchanged in shape from the Firebase version:
//   1. proxy.ts — cheap presence-only cookie check at the edge
//   2. THIS module — the authoritative check, called from the protected layout
//
// ⚠️ THE ROLE IS CONFIRMED BY THE API, NOT BY READING THE COOKIE. The access
// token carries a `role` claim and decoding it here would save a round trip,
// but a cookie this process did not verify is just a string the browser sent:
// trusting it would let a forged one render the panel, even though every call
// it then made would fail. The gate and the data have to agree about who you
// are, so both ask the same authority.

import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { apiAuthed, clearSession, readSession } from './session';

export const SESSION_COOKIE_NAME = 'roome_admin_at';

export interface AdminSession {
  uid: string;
  email: string | null;
  roles: string[];
  /** Seconds since epoch, from the token — when this session was established. */
  authTime: number;
}

interface MeResponse {
  id: string;
  role: string;
  authTime: number;
}

/**
 * Resolve the session once per render.
 *
 * ⚠️ `cache()` IS NOT AN OPTIMISATION HERE, IT IS LOAD-BEARING.
 * `managed/actions.ts` alone calls `requireAdminSession()` eight times, and the
 * protected layout calls it again — without deduplication a single page render
 * would make nine identical round trips, and a token refresh triggered by the
 * first could race the other eight.
 */
const resolve = cache(async (): Promise<AdminSession | null> => {
  const session = await readSession();
  if (!session) return null;

  try {
    const me = await apiAuthed<MeResponse>('/auth/me');
    if (!me) return null;

    // The API is the authority on the role. `ADMIN` on the wire, `admin` in
    // the array the panel has always branched on — kept so call sites that
    // check `roles.includes('admin')` did not all have to change.
    const roles = me.role ? [me.role.toLowerCase()] : [];
    if (!roles.includes('admin')) return null;

    // Email is a display detail, not part of the gate, so a failure here must
    // not sign anybody out — it comes back null and the header shows the
    // fallback.
    let email: string | null = null;
    try {
      const profile = await apiAuthed<{ email?: string | null }>(
        `/admin/users/${encodeURIComponent(me.id)}`,
      );
      email = profile?.email ?? null;
    } catch {
      email = null;
    }

    return { uid: me.id, email, roles, authTime: me.authTime };
  } catch {
    return null;
  }
});

/**
 * The gate. Use from a Server Component or a Server Action.
 * Redirects to /login on any failure.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await resolve();
  if (!session) {
    // Clear the cookies on the way out, or the proxy keeps seeing a session
    // that is present but dead and bounces between /login and here.
    await clearSession();
    redirect('/login?error=invalid_session');
  }
  return session;
}

/**
 * Like requireAdminSession but returns null instead of redirecting.
 * Used by /login itself, to bounce an already-signed-in admin to the dashboard.
 */
export async function readAdminSessionOrNull(): Promise<AdminSession | null> {
  return resolve();
}
