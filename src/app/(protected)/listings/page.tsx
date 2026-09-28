// /listings — every property on the platform.
//
// WHY IT EXISTS. Nothing in the product lists all properties: a landlord sees
// their own and a renter sees what is published. So after a round of testing,
// the rows created had to be found and removed in the database by hand. This
// is that job, done from the panel.
//
// Server Component. The filter tabs are <Link>s, the search is a plain GET
// <form>, and "load more" is a link carrying the cursor — the same shape as
// /users. The one client component is the table, because bulk selection needs
// state the DOM cannot report.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import ListingsTable from './_components/listings-table';
import {
  asStatusFilter,
  listingsHref,
  mapProperty,
  type ApiProperty,
  type PropertyCounts,
  type PropertyRow,
  type StatusFilter,
} from './_lib/types';

const PAGE_SIZE = 50;

const EMPTY_COUNTS: PropertyCounts = { all: 0, onMarket: 0, offMarket: 0, deleted: 0 };

async function loadProperties(
  status: StatusFilter,
  q: string,
  cursor: string,
): Promise<{ list: PropertyRow[]; counts: PropertyCounts; nextCursor: string | null }> {
  const res = await apiAuthed<{
    items: ApiProperty[];
    counts: PropertyCounts;
    page: { cursor: string | null; hasMore: boolean };
  }>('/admin/properties', {
    query: {
      limit: PAGE_SIZE,
      // "all" is this screen's word for "no filter", so it is not sent.
      status: status === 'all' ? undefined : status,
      q: q || undefined,
      cursor: cursor || undefined,
    },
  });

  if (!res) return { list: [], counts: EMPTY_COUNTS, nextCursor: null };
  return {
    list: res.items.map(mapProperty),
    counts: res.counts,
    nextCursor: res.page.hasMore ? res.page.cursor : null,
  };
}

type SearchParams = Promise<{ status?: string; q?: string; cursor?: string }>;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminSession();
  const t = await getT();
  const params = await searchParams;
  const status = asStatusFilter(params.status);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const cursor = typeof params.cursor === 'string' ? params.cursor : '';

  const { list, counts, nextCursor } = await loadProperties(status, q, cursor);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('listings.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('listings.subtitle')}</p>
      </header>

      <FilterTabs active={status} counts={counts} q={q} t={t} />

      <form method="GET" className="flex gap-2">
        {/* The tab has to survive a search, or searching silently drops you
            back to "all" and the result looks wrong rather than filtered. */}
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t('listings.searchPlaceholder')}
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('common.search')}
        </button>
        {q && (
          <Link
            href={listingsHref({ status })}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('common.clear')}
          </Link>
        )}
      </form>

      {list.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? t('listings.noneFound') : t('listings.noneInCategory')}
          </p>
        </section>
      ) : (
        <>
          <ListingsTable rows={list} />
          {/* A link, not a button: the next page has to survive a reload, and
              a cursor in the URL is also how somebody shares what they are
              looking at. */}
          {nextCursor && (
            <div className="flex justify-center">
              <Link
                href={listingsHref({ status, q, cursor: nextCursor })}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {t('common.loadMore')}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterTabs({
  active,
  counts,
  q,
  t,
}: {
  active: StatusFilter;
  counts: PropertyCounts;
  q: string;
  t: TFunc;
}) {
  const tabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: t('listings.tabAll'), count: counts.all },
    { value: 'on_market', label: t('listings.tabOnMarket'), count: counts.onMarket },
    { value: 'off_market', label: t('listings.tabOffMarket'), count: counts.offMarket },
    { value: 'deleted', label: t('listings.tabDeleted'), count: counts.deleted },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={listingsHref({ status: tab.value, q })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">{tab.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
