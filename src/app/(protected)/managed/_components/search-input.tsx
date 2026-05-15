'use client';

// Search input on /managed — debounced, URL-driven so it survives reloads
// and the back button. Matches on email / VAT / company name / displayUsername
// in the server-side filter.

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ManagedSearchInput({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  // Debounce: write the search term to the URL ?q= after 300ms idle. The
  // server component re-runs on URL change → fresh filtered list.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        next.delete('q');
      } else {
        next.set('q', trimmed);
      }
      router.replace(`/managed?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-sm">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search email, VAT, company…"
        autoComplete="off"
        className="block w-full rounded-md border border-input bg-surface py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}
