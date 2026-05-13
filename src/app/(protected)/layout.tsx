// Wraps every protected page. Server Component (Node runtime) — does the
// authoritative session-cookie verification + admin-role check, then renders
// a top nav with sign-out and the page's children.
//
// Per docs/architecture/admin-panel.md §8.4, middleware did the cheap
// presence check; this layout is where the cookie is actually decoded and
// the admin claim confirmed.

import type { ReactNode } from 'react';
import { requireAdminSession } from '@/lib/auth';
import SignOutButton from '@/components/sign-out-button';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">RooMe Admin</h1>
            <p className="text-xs text-gray-500">{session.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
