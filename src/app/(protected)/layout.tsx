// Wraps every protected page except the full-bleed ones. Server Component
// (Node runtime) — the authoritative session-cookie verification and
// admin-role check happen inside AdminShell.
//
// Per docs/architecture/admin-panel.md §8.4, middleware did the cheap
// presence check; the shell is where the cookie is actually decoded and the
// admin claim confirmed.
//
// The chrome itself lives in @/components/admin-shell so that `(wide)` — the
// group holding /listings — can render the same sidebar, header and locale
// provider without the reading-width column. See the note there.

import type { ReactNode } from 'react';
import AdminShell from '@/components/admin-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AdminShell contained>{children}</AdminShell>;
}
