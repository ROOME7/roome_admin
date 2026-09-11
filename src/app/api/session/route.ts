// Session management for the admin panel.
//
//   POST   /api/session — sign in. Exchanges email + password for the Roome
//                         API's tokens and stores them in httpOnly cookies.
//   DELETE /api/session — sign out. Ends the session on the API and clears
//                         the cookies.
//
// ⚠️ THE CREDENTIALS AND THE TOKENS NEVER MEET THE BROWSER'S JAVASCRIPT. The
// form posts here; this handler talks to the API server-side; the tokens come
// back into httpOnly cookies the page cannot read. That is the whole reason
// this route exists rather than the client calling the API directly — a token
// in reach of a script is a token one bad dependency away from being stolen.
//
// It replaces a Firebase flow that signed in with the client SDK, read the
// `roles` custom claim, and exchanged an ID token for a Firebase session
// cookie. Those claims lived in Firebase and were never migrated, which is why
// admin@roomeapp.it could not sign in: Firebase had never heard of it.

import { NextResponse, type NextRequest } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { clearSession, readSession, writeSession } from '@/lib/session';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  let res: Response;
  try {
    // ⚠️ `/admin/auth/login`, NOT `/auth/login`. The latter succeeds for ANY
    // account, so the panel would receive a perfectly valid token for a tenant
    // and have to remember to check the role afterwards. This one refuses a
    // non-admin before a session is ever issued.
    res = await fetch(`${apiBaseUrl()}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, deviceLabel: 'Roome Admin (web)' }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'network_error' }, { status: 502 });
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Pass the API's own code through so the form can map it to its copy. The
    // API answers `invalid_credentials` for a wrong password, an unknown
    // address AND a non-admin, deliberately — a distinct error for the last
    // one would confirm that the account exists and the password was right.
    return NextResponse.json(
      { error: data?.error?.code ?? 'sign_in_failed', message: data?.error?.message ?? null },
      { status: res.status },
    );
  }

  if (!data?.accessToken || !data?.refreshToken) {
    return NextResponse.json({ error: 'sign_in_failed' }, { status: 502 });
  }

  await writeSession(data);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await readSession();

  // Best-effort: end it on the API too, so the refresh token cannot be spent
  // again. A failure here must not stop the local cookies being cleared —
  // otherwise a network blip leaves somebody unable to sign out.
  if (session?.refreshToken) {
    try {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignored on purpose — see above.
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
