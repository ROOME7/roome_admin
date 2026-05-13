// Server-side auth helpers — read + verify the Firebase session cookie.
//
// Two layers of checking (see docs/architecture/admin-panel.md §8.4):
//   1. middleware.ts: cheap presence-only check (Edge runtime, no firebase-admin)
//   2. THIS module: authoritative verify in a Server Component, called from
//      the protected layout. Returns user + claims for downstream pages, or
//      redirects to /login if anything's off.

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { serverAuth } from './firebase-admin';

export const SESSION_COOKIE_NAME = '__session';

export interface AdminSession {
  uid: string;
  email: string | null;
  roles: string[];
  authTime: number; // seconds since epoch — Unix
  claims: DecodedIdToken;
}

/**
 * Verifies the session cookie and confirms the 'admin' role.
 * Use from a Server Component (e.g. the protected layout).
 * Redirects to /login on any failure mode.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!session) redirect('/login');

  let decoded: DecodedIdToken;
  try {
    // checkRevoked: true — talks to Firebase to confirm refresh tokens
    // haven't been revoked since the cookie was issued. Adds ~30-80ms but
    // means revokeRefreshTokens() takes effect within seconds, not on TTL.
    decoded = await serverAuth().verifySessionCookie(session, true);
  } catch {
    redirect('/login?error=invalid_session');
  }

  const roles = Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [];
  if (!roles.includes('admin')) {
    redirect('/login?error=not_admin');
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    roles,
    authTime: decoded.auth_time,
    claims: decoded,
  };
}

/**
 * Like requireAdminSession but returns null instead of redirecting.
 * Use when a page renders for both signed-in and signed-out states
 * (the /login page itself — to bounce already-signed-in admins to /).
 */
export async function readAdminSessionOrNull(): Promise<AdminSession | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    const decoded = await serverAuth().verifySessionCookie(session, true);
    const roles = Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [];
    if (!roles.includes('admin')) return null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      roles,
      authTime: decoded.auth_time,
      claims: decoded,
    };
  } catch {
    return null;
  }
}
