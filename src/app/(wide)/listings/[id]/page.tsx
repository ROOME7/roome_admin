// /listings/[id] — one property, and what its calendar feeds have actually done.
//
// WHY IT EXISTS. A landlord attaches an iCal URL and then nobody can tell
// whether it worked. The sync is a nightly cron (05:00 Europe/Rome), its
// failures are written to a row no screen reads, and the only visible symptom
// is a room showing free or taken when it should not be. Support had to ask an
// engineer to query the database. This is that query, as a page.
//
// Server Component throughout: it renders once and holds no state.

import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiAuthed } from '@/lib/session';
import { requireAdminSession } from '@/lib/auth';
import { getT } from '@/i18n/server';
import type { TFunc } from '@/i18n/t';
import type { PropertyDetail, RoomDetail } from '../_lib/types';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const t = await getT();
  const { id } = await params;

  const p = await apiAuthed<PropertyDetail>(`/admin/properties/${id}`);
  if (!p) notFound();

  return (
    <div className="space-y-6 px-6 pb-16 pt-8">
      <div>
        <Link href="/listings" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('listings.backToList')}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{p.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[p.city, p.province, p.postalCode].filter(Boolean).join(' · ')}
          {' — '}
          {p.owner.name ?? `@${p.owner.username}`} ({p.owner.email})
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-4">
        <Fact label={t('listings.colStatus')} value={t(`listings.status${statusKey(p.status)}`)} />
        <Fact label={t('listings.colRooms')} value={String(p.roomCount)} />
        <Fact label={t('listings.colListed')} value={String(p.activeListings)} />
        <Fact label={t('listings.colContracts')} value={String(p.contractCount)} />
        <Fact label={t('listings.detailType')} value={p.propertyType ?? '—'} />
        <Fact label={t('listings.detailArea')} value={p.area?.name ?? '—'} />
        <Fact label={t('listings.detailSource')} value={p.source ?? t('listings.detailInApp')} />
        <Fact label={t('listings.colCreated')} value={dateOnly.format(new Date(p.createdAt))} />
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('listings.detailRooms')}</h2>
        {p.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('listings.detailNoRooms')}</p>
        ) : (
          p.rooms.map((room, i) => <RoomCard key={room.id} room={room} index={i + 1} t={t} />)
        )}
      </section>
    </div>
  );
}

function statusKey(s: PropertyDetail['status']) {
  return s === 'on_market' ? 'OnMarket' : s === 'off_market' ? 'OffMarket' : 'Deleted';
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function RoomCard({ room, index, t }: { room: RoomDetail; index: number; t: TFunc }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <h3 className="font-semibold text-foreground">
          {room.name || t('listings.detailRoomN', { n: index })}
        </h3>
        <span className="text-sm text-muted-foreground">{money(room.priceCents, room.currency)}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{room.status}</span>
        {room.listing && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('listings.detailListing')}: {room.listing.status}
          </span>
        )}
      </div>
      <CalendarPanel room={room} t={t} />
    </div>
  );
}

/**
 * Everything the nightly sync knows about this room's feed.
 *
 * ⚠️ THE THREE STATES ARE DELIBERATE: no feed, a feed that has never run, and
 * a feed that has run. The middle one is the one worth naming — it is not a
 * failure, it is a landlord who saved a URL after 05:00 — and a screen that
 * collapsed it into "not working" would send people to support over a feed
 * that is about to work by itself.
 */
function CalendarPanel({ room, t }: { room: RoomDetail; t: TFunc }) {
  const feed = room.calendar;

  if (!feed) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">{t('listings.icalNoFeed')}</p>
    );
  }

  const failing = feed.failureCount > 0;

  return (
    <div className="space-y-3 px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label={t('listings.icalSource')} value={feed.source ?? '—'} />
        <Fact
          label={t('listings.icalLastSync')}
          value={
            feed.neverSynced
              ? t('listings.icalNeverRun')
              : dateTime.format(new Date(feed.lastSyncedAt as string))
          }
        />
        <Fact label={t('listings.icalStatus')} value={feed.lastStatus ?? '—'} />
        <Fact label={t('listings.icalFailures')} value={String(feed.failureCount)} />
      </dl>

      {/* ⚠️ THE URL IS A CREDENTIAL — anyone holding it can read the
          landlord's bookings, which is why the sync service keeps it out of
          its own logs. It is shown here because this page is admin-only and
          diagnosing a feed without seeing the URL is guesswork. `break-all`
          rather than truncation: a half-shown URL cannot be checked against
          the one the landlord pasted. */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t('listings.icalUrl')}
        </p>
        <code className="block break-all rounded bg-secondary px-2 py-1 text-xs text-foreground">
          {feed.url}
        </code>
      </div>

      {feed.neverSynced && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          {t('listings.icalPendingExplain')}
        </p>
      )}

      {/* `lastError` is ALSO set on a successful sync that skipped events, so
          the wording follows failureCount rather than the presence of text. */}
      {feed.lastError && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            failing ? 'bg-destructive/5 text-destructive' : 'bg-amber-500/10 text-amber-700'
          }`}
        >
          <span className="font-medium">
            {failing ? t('listings.icalLastError') : t('listings.icalPartial')}:
          </span>{' '}
          {feed.lastError}
        </p>
      )}

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {t('listings.icalBlocks', { count: room.icalBlockCount })}
        </p>
        {room.icalBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {feed.neverSynced ? t('listings.icalBlocksPending') : t('listings.icalBlocksNone')}
          </p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="border-b border-border py-1 pr-4 font-semibold">{t('listings.icalFrom')}</th>
                <th className="border-b border-border py-1 pr-4 font-semibold">{t('listings.icalUntil')}</th>
                <th className="border-b border-border py-1 pr-4 font-semibold">{t('listings.icalSummary')}</th>
                <th className="border-b border-border py-1 font-semibold">{t('listings.icalUid')}</th>
              </tr>
            </thead>
            <tbody>
              {room.icalBlocks.map((b) => (
                <tr key={b.id} className={b.current ? 'bg-primary/5 font-medium' : ''}>
                  <td className="border-b border-border py-1 pr-4 tabular-nums">
                    {dateOnly.format(new Date(b.startDate))}
                  </td>
                  {/* Exclusive, as iCalendar defines DTEND — shown as the feed
                      stated it rather than decremented, so this page and the
                      source agree when somebody compares them. */}
                  <td className="border-b border-border py-1 pr-4 tabular-nums">
                    {dateOnly.format(new Date(b.endDate))}
                  </td>
                  <td className="border-b border-border py-1 pr-4">{b.summary ?? '—'}</td>
                  <td className="max-w-[18rem] truncate border-b border-border py-1 text-xs text-muted-foreground">
                    {b.externalUid ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
