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
    { value: 'open', label: t('moderation.filterOpen') },
    { value: 'reviewing', label: t('moderation.filterReviewing') },
    { value: 'resolved', label: t('moderation.filterResolved') },
    { value: 'dismissed', label: t('moderation.filterDismissed') },
    { value: 'all', label: t('moderation.filterAll') },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('moderation.filterAriaLabel')}
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`/moderation?filter=${tab.value}`}
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
