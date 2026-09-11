'use client';

// Client-side sign-in form.
//
// Flow:
//   1. POST the credentials to /api/session.
//   2. That route calls the Roome API server-side and stores the tokens in
//      httpOnly cookies this page cannot read.
//   3. Navigate to the requested redirect path.
//
// ⚠️ NO PASSWORD OR TOKEN IS HANDLED BY THIS COMPONENT BEYOND THE POST. The
// previous version signed in with the Firebase client SDK, read the `roles`
// custom claim in the browser and decided locally whether the account was an
// admin. The role is now decided by the API, which refuses a non-admin before
// a session exists — a check in the browser is a suggestion.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

  /**
   * An API error code, in the panel's own words.
   *
   * ⚠️ `invalid_credentials` COVERS "NOT AN ADMIN" TOO, and that is not a gap
   * in this map. The API answers the same thing for a wrong password, an
   * unknown address and a real password on a non-admin account — a distinct
   * error for the last would confirm both that the account exists and that the
   * password just tried was correct.
   */
  function messageForCode(code: string, fallback?: string | null): string {
    switch (code) {
      case 'invalid_credentials':
      case 'missing_credentials':
        return t('login.errInvalidCredential');
      case 'rate_limited':
        return t('login.errTooManyAttempts');
      case 'network_error':
        return t('login.errNetwork');
      case 'account_suspended':
        // No dedicated string, and the API's own message says it plainly in
        // the reader's language — better than a vaguer one of ours.
        return fallback ?? t('login.errSignInFailed');
      default:
        return fallback ?? t('login.errSignInFailed');
    }
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
      // `credentials: 'include'` is redundant on a same-origin POST per spec,
      // but some extensions inject a stricter default and silently drop the
      // response's Set-Cookie header. Being explicit rules that out.
      const res = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(messageForCode(String(data?.error ?? ''), data?.message));
        setSubmitting(false);
        return;
      }

      // router.replace so /login is not left in the back history.
      router.replace(redirectPath);
    } catch {
      // Only a genuine transport failure reaches here — the handler above
      // turns every API refusal into a rendered message.
      setError(t('login.errNetwork'));
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
          name="email"
          type="email"
          autoComplete="username"
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
          name="password"
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
