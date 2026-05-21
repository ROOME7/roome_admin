'use client';

// Secondary filters for /managed: owner-type and admin-owner. URL-driven
// so deep links + back-button work.
//
// The primary status filter (active/suspended/handed_over/archived/all)
// stays in filter-tabs.tsx — it's a different visual treatment (large
// counts), kept separate.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/client';
import type { OwnerType } from '../_lib/types';

export function OwnerTypeChips({ active }: { active: OwnerType | 'all' }) {
  const t = useT();
  const sp = useSearchParams();
  const items: { value: OwnerType | 'all'; label: string }[] = [
    { value: 'all', label: t('managed.ownerTypeAll') },
    { value: 'owner_b2c', label: t('managed.ownerTypePrivate') },
    { value: 'owner_b2b', label: t('managed.ownerTypeInstitutional') },
  ];
  return (
    <ChipRow
      paramKey="ownerType"
      items={items.map((i) => ({ value: i.value, label: i.label }))}
      active={active}
      paramsString={sp.toString()}
    />
  );
}

export function MineOnlyChips({
  active,
  adminUid,
}: {
  active: 'any' | 'mine';
  adminUid: string;
}) {
  const t = useT();
  const sp = useSearchParams();
  const items: { value: 'any' | 'mine'; label: string }[] = [
    { value: 'any', label: t('managed.ownerAny') },
    { value: 'mine', label: t('managed.ownerMine') },
  ];
  return (
    <ChipRow
      paramKey="owner"
      items={items.map((i) => ({
        value: i.value,
        label: i.label,
        hiddenParam: i.value === 'mine' ? { admin: adminUid } : undefined,
      }))}
      active={active}
      paramsString={sp.toString()}
    />
  );
}

function ChipRow({
  paramKey,
  items,
  active,
  paramsString,
}: {
  paramKey: string;
  items: {
    value: string;
    label: string;
    hiddenParam?: Record<string, string>;
  }[];
  active: string;
  paramsString: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
      {items.map((item) => {
        const isActive = item.value === active;
        const params = new URLSearchParams(paramsString);
        if (item.value === 'all' || item.value === 'any') {
          params.delete(paramKey);
        } else {
          params.set(paramKey, item.value);
        }
        return (
          <Link
            key={item.value}
            href={`/managed?${params.toString()}`}
            scroll={false}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
