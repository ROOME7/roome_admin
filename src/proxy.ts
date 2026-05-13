// Edge-runtime proxy (Next.js 16+; previously called middleware): cheap
// presence-only check on the session cookie.
//
// We deliberately do NOT verify the cookie here because:
//   - firebase-admin uses Node-only modules, can't run on Edge
//   - Verifying via JWKS in middleware adds latency to every request
//
// Authoritative verification (cookie validity, admin role, revocation check)
// happens in the protected layout's Server Component — see
// docs/architecture/admin-panel.md §8.4 + src/lib/auth.ts.
//
// This middleware just answers: "is there a cookie?" — if not, bounce to
// /login. Cheap, fast, can't be fooled into thinking you're an admin without
// going through the real verification on the next hop.

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = '__session';

// Paths that DON'T require a session: the login page itself, the session API
// (used for sign-in), Next.js internals, and public assets.
const PUBLIC_PATHS = [
  '/login',
  '/api/session',
  '/_next',
  '/favicon.ico',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Exclude API routes from proxy redirects (they should return 401 JSON,
// not HTML redirects). Static files are excluded by the PUBLIC_PATHS check.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
