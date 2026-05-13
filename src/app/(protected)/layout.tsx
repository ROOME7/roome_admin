// Wraps every protected page. Server Component (Node runtime) — does the
// authoritative session-cookie verification + admin-role check, then renders
// the sidebar layout with the page's children.
//
// Per docs/architecture/admin-panel.md §8.4, middleware did the cheap
// presence check; this layout is where the cookie is actually decoded and
// the admin claim confirmed.

import type { ReactNode } from 'react';
import { requireAdminSession } from '@/lib/auth';
import Sidebar from '@/components/sidebar';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="min-h-screen bg-secondary">
      <Sidebar user={{ email: session.email, uid: session.uid }} />
      <main className="ml-64">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
