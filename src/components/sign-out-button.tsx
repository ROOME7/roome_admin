'use client';

// Sign-out button — clears the session cookie server-side (which also revokes
// refresh tokens, killing any other browser/device sessions for this user)
// and signs the client SDK out of Firebase Auth.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { adminAuth } from '@/lib/firebase-client';

export default function SignOutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } catch {
      // Cookie clear is server-driven; if the request fails, the cookie may
      // still be present locally — fall through and the next page load will
      // bounce to /login anyway.
    }
    try {
      await signOut(adminAuth);
    } catch {
      // ignore
    }
    router.replace('/login');
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
