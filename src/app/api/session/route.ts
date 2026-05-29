// Session cookie management.
//
//   POST /api/session  — exchange a fresh Firebase ID token for an httpOnly
//                        session cookie. Called immediately after a client-side
//                        sign-in succeeds and the ID token has been verified
//                        to carry the admin role.
//
//   DELETE /api/session — clear the cookie + revoke the refresh tokens so all
//                         other sessions for this user are killed within
//                         seconds. Called on sign-out.
//
// Why a session cookie rather than just sending the ID token on each request?
// See docs/architecture/admin-panel.md §8.3 — long-lived, httpOnly,
// server-revocable, designed for browser-based admin panels.

import { NextResponse, type NextRequest } from 'next/server';
import { serverAuth } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

// Browser-cookie lifetime. Override via SESSION_COOKIE_MAX_AGE_SECONDS env
// (clamped between 1 minute and Firebase's 14-day max). 24h matches a normal
// admin workday and avoids forcing re-sign-in after lunch; the 8h default
// we shipped initially was too aggressive — admins complained that closing
// the window mid-session bumped them back to /login on the next open.
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

function getMaxAgeSeconds(): number {
  const raw = process.env.SESSION_COOKIE_MAX_AGE_SECONDS;
  if (!raw) return DEFAULT_MAX_AGE_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60 || parsed > 14 * 24 * 60 * 60) {
    return DEFAULT_MAX_AGE_SECONDS;
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const idToken = body.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  // 1. Decode + verify the ID token to confirm the caller actually is admin.
  //    Without this check, a non-admin could call POST /api/session with their
  //    own ID token and get a session cookie that middleware would accept on
  //    presence — the protected layout would reject them, but defence in depth.
  let decoded;
  try {
    decoded = await serverAuth().verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }

  const roles = Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [];
  if (!roles.includes('admin')) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  // 2. Mint the session cookie. expiresIn is in milliseconds for this API.
  const maxAgeSeconds = getMaxAgeSeconds();
  const sessionCookie = await serverAuth().createSessionCookie(idToken, {
    expiresIn: maxAgeSeconds * 1000,
  });

  const res = NextResponse.json({ ok: true });
  // IMPORTANT: set both `maxAge` AND `expires`. Some Next.js 16 build paths
  // (and certain CDN proxies) drop the `Max-Age=` attribute when only
  // `maxAge` is passed, leaving the browser to treat the result as a
  // session-only cookie that disappears when the window closes — exactly
  // the bug admins were hitting. The two attributes together survive that
  // round-trip: browsers prefer `Max-Age` per RFC 6265 and fall back to
  // `Expires` if it's missing.
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds,
    expires,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });

  // Try to identify the user from the existing cookie so we can revoke their
  // refresh tokens. If the cookie is already invalid, just clear it locally.
  const cookieHeader = res.headers; // placeholder — we read req cookies below
  try {
    const reqCookies = (await import('next/headers')).cookies;
    const session = (await reqCookies()).get(SESSION_COOKIE_NAME)?.value;
    if (session) {
      const decoded = await serverAuth().verifySessionCookie(session, false);
      // Revoke refresh tokens — kills all other devices' sessions for this
      // user. checkRevoked:true on every verify call means they're booted
      // within seconds.
      await serverAuth().revokeRefreshTokens(decoded.sub);
    }
  } catch {
    // best-effort; the important thing is clearing the cookie below.
  }

  // Mirror the same maxAge + expires pair so the clear instruction can't be
  // misinterpreted as a session cookie either — `expires` in the past
  // forces immediate deletion.
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
