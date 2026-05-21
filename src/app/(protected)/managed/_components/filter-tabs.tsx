import Link from 'next/link';
import type { TFunc } from '@/i18n/t';
import type { FilterValue } from '../_lib/types';

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
    { value: 'active', label: t('managed.tabManaged') },
    { value: 'suspended', label: t('managed.tabSuspended') },
    { value: 'handed_over', label: t('managed.tabHandedOver') },
    { value: 'archived', label: t('managed.tabArchived') },
    { value: 'all', label: t('managed.tabAll') },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('managed.filterTabsAriaLabel')}
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`/managed?filter=${tab.value}`}
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
