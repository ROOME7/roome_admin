'use client';

// Bottom tile in the sidebar: avatar + email + chevron, click to open a
// dropdown above with Settings + Sign out. Sign-out logic is inlined here
// (clears the session cookie server-side, signs the client SDK out, then
// router.replace to /login) so we don't need a separate SignOutButton.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { adminAuth } from '@/lib/firebase-client';

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.97l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-muted-foreground"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function getInitial(email: string | null): string {
  if (!email) return '?';
  const ch = email.trim().charAt(0).toUpperCase();
  return ch || '?';
}

type UserMenuProps = {
  user: { email: string | null; uid: string };
};

export default function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } catch {
      // best-effort — cookie clear is server-driven, even if the request fails
      // the next page load will redirect to /login because the cookie was
      // either cleared or has expired claims.
    }
    try {
      await signOut(adminAuth);
    } catch {
      // ignore
    }
    router.replace('/login');
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Dropdown — anchored above the tile */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <GearIcon />
            Settings
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SignOutIcon />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}

      {/* The tile itself */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-roome-blue-dark text-xs font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {getInitial(user.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {user.email ?? 'admin'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">Admin</span>
        </span>
        <span className="shrink-0">
          <ChevronIcon />
        </span>
      </button>
    </div>
  );
}
