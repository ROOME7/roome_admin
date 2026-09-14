// /calendars — the partner calendars that keep availability current.
//
// ⚠️ THE FEED URLS ARE NOT ON THIS PAGE, AND CANNOT BE. They carry the
// authorisation in the URL itself, so anyone holding one reads that room's
// bookings. The API does not return them and the shape it does return has no
// field to put one in.

import 'server-only';
import Link from 'next/link';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import { SyncButton } from './_components/sync-button';

interface ApiFeed {
  id: string;
  roomId: string;
  roomName: string | null;
  roomStatus: string;
  availableFrom: string | null;
  blocks: number;
  property: { id: string; name: string | null; address: string; city: string };
  source: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  failureCount: number;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

async function loadFeeds(failingOnly: boolean): Promise<ApiFeed[]> {
  const res = await apiAuthed<{ items: ApiFeed[] }>(
    `/admin/calendars${failingOnly ? '?failingOnly=true' : ''}`,
  );
  return res?.items ?? [];
}

type SearchParams = Promise<{ filter?: string }>;

export default async function CalendarsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminSession();
  const params = await searchParams;
  const failingOnly = params.filter === 'failing';
  const [t, feeds] = await Promise.all([getT(), loadFeeds(failingOnly)]);

  const failing = feeds.filter((f) => f.failureCount > 0).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('calendars.title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('calendars.subtitle')}
          </p>
        </div>
        <SyncButton />
      </header>

      <div className="flex items-center gap-2">
        <Tab href="/calendars" active={!failingOnly} label={`${t('calendars.all')} · ${feeds.length}`} />
        <Tab
          href="/calendars?filter=failing"
          active={failingOnly}
          label={`${t('calendars.failingOnly')} · ${failingOnly ? feeds.length : failing}`}
        />
      </div>

      {feeds.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">{t('calendars.empty')}</p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('calendars.room')}</th>
                <th className="px-4 py-3 font-medium">{t('calendars.property')}</th>
                <th className="px-4 py-3 font-medium">{t('calendars.status')}</th>
                <th className="px-4 py-3 font-medium tabular-nums">{t('calendars.blocks')}</th>
                <th className="px-4 py-3 font-medium">{t('calendars.availableFrom')}</th>
                <th className="px-4 py-3 font-medium">{t('calendars.lastSync')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {feeds.map((feed) => (
                <FeedRow key={feed.id} feed={feed} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('calendars.urlHidden')}</p>
    </div>
  );
}

function FeedRow({ feed, t }: { feed: ApiFeed; t: TFunc }) {
  const failing = feed.failureCount > 0;
  return (
    <tr className={failing ? 'bg-destructive/5' : undefined}>
      <td className="px-4 py-3">
        <Link href={`/users/${feed.property.id}`} className="font-medium text-foreground hover:underline">
          {feed.roomName ?? feed.roomId.slice(0, 8)}
        </Link>
        {feed.source && (
          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {feed.source}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <span className="text-foreground">{feed.property.name ?? feed.property.address}</span>
        <span className="ml-1 text-xs">{feed.property.city}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            feed.roomStatus === 'occupied'
              ? 'bg-amber-500/10 text-amber-700'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {feed.roomStatus}
        </span>
        {/* The failure is what a partner conversation starts from, so it is
            shown in full rather than as a count. */}
        {failing && (
          <p className="mt-1 text-xs text-destructive">
            {t('calendars.failures', { count: feed.failureCount })}
            {feed.lastError ? ` · ${feed.lastError}` : ''}
          </p>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{feed.blocks}</td>
      <td className="px-4 py-3 text-muted-foreground">{feed.availableFrom ?? '—'}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {feed.lastSyncedAt ? dateFormatter.format(new Date(feed.lastSyncedAt)) : t('calendars.never')}
      </td>
    </tr>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-border bg-secondary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
