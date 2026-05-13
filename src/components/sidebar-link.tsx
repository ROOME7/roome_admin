'use client';

// A single sidebar nav item. Reads pathname to highlight when active.
//
// `exact: true` for the root (/) so it doesn't stay highlighted when the user
// is on /supervision (which also "starts with" /). Sub-routes of /supervision
// and /managed still highlight their parent — that's intentional.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type SidebarLinkProps = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
};

export default function SidebarLink({
  href,
  label,
  icon,
  exact = false,
}: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-secondary text-primary'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
      }`}
    >
      <span
        className={`shrink-0 transition-colors ${
          isActive
            ? 'text-primary'
            : 'text-muted-foreground/70 group-hover:text-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
