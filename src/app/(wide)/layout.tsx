// The full-bleed half of the panel: same auth, same chrome, no reading-width
// column.
//
// A route group adds no path segment, so everything under here keeps its URL
// — /listings is still /listings. It exists purely so a screen can opt out of
// the `max-w-6xl` container without every other screen having to move.

import type { ReactNode } from 'react';
import AdminShell from '@/components/admin-shell';

export default function WideLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
