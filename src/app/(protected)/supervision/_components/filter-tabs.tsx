// URL-based filter tabs. Server-rendered; uses <Link> so it's progressive-
// enhancement-friendly (works without JS, then turns into a client nav).

import Link from 'next/link';
import type { FilterValue } from '../_lib/types';
import type { TFunc } from '@/i18n/t';

export function FilterTabs({
  active,
  counts,
  t,
}: {
  active: FilterValue;
  counts: Record<FilterValue, number>;
  t: TFunc;
}) {
  const TABS: { value: FilterValue; label: string }[] = [
    { value: 'pending', label: t('common.statusPending') },
    { value: 'approved', label: t('common.statusApproved') },
    { value: 'rejected', label: t('common.statusRejected') },
    { value: 'all', label: t('common.all') },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('supervision.filterAriaLabel')}
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`/supervision?filter=${tab.value}`}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                isActive
                  ? 'bg-surface text-foreground ring-1 ring-border'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts[tab.value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
