// Fixed left sidebar. Logo at top, three nav items in the middle, user tile
// at the bottom that opens a dropdown for Settings + Sign out.
//
// Rendered by app/(protected)/layout.tsx. Static structure (server-okay)
// except for SidebarLink (active-route highlighting via usePathname) and
// UserMenu (dropdown state), which are their own client components.

import SidebarLink from './sidebar-link';
import UserMenu from './user-menu';

// Single inline SVG <Icon> wrapper so we can pass any 24x24 path without a
// dependency on heroicons/lucide. Outline-style strokes match the visual
// language of most admin panels.
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  );
}

function SupervisionIcon() {
  return (
    <Icon>
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.55.93 6.15 2.45" />
    </Icon>
  );
}

function ManagedIcon() {
  return (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

// Brand mark — RooMe wordmark with a roome-blue square. Drop in real
// artwork later by swapping this element; the colors come from the
// design tokens so they stay aligned with the marketing site / app.
function Logo() {
  return (
    <div className="flex items-center gap-2.5" aria-label="RooMe Admin">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-roome-blue text-sm font-bold text-primary-foreground shadow-sm"
        aria-hidden="true"
      >
        R
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        RooMe
      </span>
    </div>
  );
}

type SidebarProps = {
  user: {
    email: string | null;
    uid: string;
  };
};

export default function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
      {/* Logo header */}
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo />
      </div>

      {/* Nav */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Primary"
      >
        <SidebarLink href="/" label="Dashboard" icon={<DashboardIcon />} exact />
        <SidebarLink
          href="/supervision"
          label="Supervision & Approval"
          icon={<SupervisionIcon />}
        />
        <SidebarLink
          href="/managed"
          label="Active Management"
          icon={<ManagedIcon />}
        />
      </nav>

      {/* User tile + dropdown */}
      <div className="border-t border-border p-3">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
