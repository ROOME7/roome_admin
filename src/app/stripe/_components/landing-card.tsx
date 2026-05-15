// Shared landing-page shell for the five public Stripe redirect targets
// under /stripe/*. Server Component — receives an optional "adminLink"
// flag so callers can pass true when they detect a signed-in admin
// session and want to surface a "return to admin panel" CTA.

import Link from 'next/link';
import type { ReactNode } from 'react';

export type LandingTone = 'success' | 'neutral' | 'warning';

interface Props {
  tone: LandingTone;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  /** When non-null, render a CTA button below the body. */
  cta?: {
    href: string;
    label: string;
  } | null;
}

const TONE_BG: Record<LandingTone, string> = {
  success: 'bg-primary/10 text-primary',
  neutral: 'bg-secondary text-foreground',
  warning: 'bg-amber-500/10 text-amber-700',
};

export function LandingCard({ tone, icon, title, body, cta }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${TONE_BG[tone]}`}
          aria-hidden
        >
          {icon}
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">{body}</div>

        {cta && (
          <Link
            href={cta.href}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </main>
  );
}

// Pre-built SVG icons used by the five landing pages. Inlined here so each
// page is a single import.

export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
