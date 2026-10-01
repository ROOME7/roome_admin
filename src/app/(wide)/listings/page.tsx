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
  asIcalFilter,
  asStatusFilter,
  listingsHref,
  mapProperty,
  type ApiProperty,
  type IcalFilter,
  type PropertyCounts,
  type PropertyRow,
  type StatusFilter,
} from './_lib/types';

const PAGE_SIZE = 50;

const EMPTY_COUNTS: PropertyCounts = { all: 0, onMarket: 0, offMarket: 0, deleted: 0 };

async function loadProperties(
  status: StatusFilter,
  ical: IcalFilter,
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
      ical: ical === 'all' ? undefined : ical,
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

type SearchParams = Promise<{ status?: string; ical?: string; q?: string; cursor?: string }>;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminSession();
  const t = await getT();
  const params = await searchParams;
  const status = asStatusFilter(params.status);
  const ical = asIcalFilter(params.ical);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const cursor = typeof params.cursor === 'string' ? params.cursor : '';

  const { list, counts, nextCursor } = await loadProperties(status, ical, q, cursor);

  return (
    // Full bleed: this screen is in the `(wide)` route group, so there is no
    // reading-width column around it. The controls keep a comfortable gutter;
    // the table itself runs edge to edge, which is the point.
    <div className="pb-10">
      <header className="px-6 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('listings.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('listings.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 px-6 py-5">
        <FilterTabs active={status} counts={counts} ical={ical} q={q} t={t} />
        <IcalTabs active={ical} status={status} q={q} t={t} />

        <form method="GET" className="flex flex-1 justify-end gap-2">
          {/* Every other control has to survive a search, or searching
              silently drops you back to "all" and the result looks wrong
              rather than filtered. */}
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {ical !== 'all' && <input type="hidden" name="ical" value={ical} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('listings.searchPlaceholder')}
            className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {t('common.search')}
          </button>
          {q && (
            <Link
              href={listingsHref({ status, ical })}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('common.clear')}
            </Link>
          )}
        </form>
      </div>

      {list.length === 0 ? (
        <section className="mx-6 rounded-lg border border-dashed border-border bg-surface p-10 text-center">
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
            <div className="flex justify-center pt-6">
              <Link
                href={listingsHref({ status, ical, q, cursor: nextCursor })}
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
  ical,
  q,
  t,
}: {
  active: StatusFilter;
  counts: PropertyCounts;
  ical: IcalFilter;
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
            href={listingsHref({ status: tab.value, ical, q })}
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

/**
 * The iCal filter.
 *
 * ⚠️ NO COUNTS ON THESE, unlike the status tabs. The badge numbers beside
 * "All / On market" describe the whole population and deliberately do not
 * move as you type — they come from a separate query. Putting an unbadged
 * count here would either need a second pair of counts on every request or
 * would have to count the filtered result, and a number that changes meaning
 * depending on which control you touched is worse than no number.
 */
function IcalTabs({
  active,
  status,
  q,
  t,
}: {
  active: IcalFilter;
  status: StatusFilter;
  q: string;
  t: TFunc;
}) {
  const tabs: { value: IcalFilter; label: string }[] = [
    { value: 'all', label: t('listings.icalAny') },
    { value: 'yes', label: t('listings.icalWith') },
    { value: 'no', label: t('listings.icalWithout') },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      <span className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
        {t('listings.colIcal')}
      </span>
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={listingsHref({ status, ical: tab.value, q })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab.value === active
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
