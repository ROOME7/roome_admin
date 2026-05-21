'use client';

// Client-side sign-in form.
//
// Flow:
//   1. signInWithEmailAndPassword (Firebase Auth — client SDK)
//   2. Force-refresh the ID token (true arg) so the latest custom claims
//      are present. Just-promoted admins won't have the claim in their
//      old cached token; this re-fetch picks it up.
//   3. Read claims locally; if no 'admin' role, sign out + show error.
//   4. POST the ID token to /api/session to mint the httpOnly session cookie.
//   5. Navigate to the requested redirect path.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { adminAuth } from '@/lib/firebase-client';
import { useT } from '@/i18n/client';

export default function LoginForm({
  redirectPath,
  initialError,
}: {
  redirectPath: string;
  initialError?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function errorMessageFor(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-email':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return t('login.errInvalidCredential');
        case 'auth/too-many-requests':
          return t('login.errTooManyAttempts');
        case 'auth/network-request-failed':
          return t('login.errNetwork');
        default:
          return error.message;
      }
    }
    return error instanceof Error ? error.message : t('login.errSignInFailed');
  }

  const ERROR_COPY: Record<string, string> = {
    not_admin: t('login.errNotAdmin'),
    invalid_session: t('login.errSessionExpired'),
  };

  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_COPY[initialError] ?? null) : null
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // 1. Sign in via Firebase Auth.
      const cred = await signInWithEmailAndPassword(adminAuth, email.trim(), password);

      // 2. Force-refresh the ID token to pick up the latest claims.
      const tokenResult = await cred.user.getIdTokenResult(true);
      const roles = Array.isArray(tokenResult.claims.roles)
        ? (tokenResult.claims.roles as string[])
        : [];

      // 3. Admin gate. Sign out + error if the account doesn't qualify.
      if (!roles.includes('admin')) {
        await signOut(adminAuth);
        setError(t('login.errNotAdminContact'));
        setSubmitting(false);
        return;
      }

      // 4. Exchange the ID token for an httpOnly session cookie.
      const idToken = tokenResult.token;
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? t('login.errSessionFailed', { status: String(res.status) }));
      }

      // 5. Navigate. router.replace so /login isn't in the back history.
      router.replace(redirectPath);
    } catch (err) {
      setError(errorMessageFor(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          {t('login.emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="mt-1 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          {t('login.passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          className="mt-1 block w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t('login.signingIn') : t('login.signIn')}
      </button>
    </form>
  );
}
