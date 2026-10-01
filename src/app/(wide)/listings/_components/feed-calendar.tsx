// The busy windows an iCal feed produced, drawn as months.
//
// WHY A CALENDAR AND NOT THE TABLE. The client's complaint was that nobody
// can tell whether an iCal link is working. A table of ISO dates answers that
// only if you are willing to do the arithmetic; a month grid answers it at a
// glance, because "the feed is working" looks like shaded days and "it is
// not" looks like an empty grid.
//
// Server Component: it draws once from data it is handed and has no state.

import type { IcalBlock } from '../_lib/types';

/**
 * ⚠️ DATES ARE COMPARED AS INTEGERS, NOT AS `Date`s.
 *
 * These are calendar days — `2026-09-30` — not instants. Parsing them into
 * `Date` and comparing puts them through the server's timezone, and every
 * window silently shifts a day in either direction depending on where the box
 * is and what month it is. `20260930` has no timezone to get wrong.
 */
const toNum = (iso: string) => Number(iso.slice(0, 10).replace(/-/g, ''));
const dayNum = (d: Date) =>
  d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

/** How many months to draw at most, however long the feed runs. */
const MAX_MONTHS = 12;

interface Span {
  from: number;
  /** EXCLUSIVE, as iCalendar defines DTEND and as the API passes it through. */
  to: number;
  summary: string | null;
}

export default function FeedCalendar({
  blocks,
  locale,
  labels,
}: {
  blocks: IcalBlock[];
  locale: string;
  labels: { today: string; past: string; busy: string };
}) {
  if (blocks.length === 0) return null;

  const spans: Span[] = blocks.map((b) => ({
    from: toNum(b.startDate),
    to: toNum(b.endDate),
    summary: b.summary,
  }));

  const today = dayNum(new Date());
  const earliest = Math.min(...spans.map((s) => s.from));
  const latest = Math.max(...spans.map((s) => s.to));

  // Start at this month, because an admin is asking about now — with two
  // exceptions, both of which would otherwise spend the twelve-month budget
  // drawing empty grids: a feed entirely in the past (start where the data
  // is, or there is nothing to see) and a feed that only begins later (start
  // where it begins, not at a "now" it has nothing to say about).
  const startAt =
    latest <= today ? monthStart(earliest) : Math.max(monthStart(today), monthStart(earliest));
  const months = monthsBetween(startAt, latest, MAX_MONTHS);
  const hiddenPast = spans.filter((s) => s.to <= monthStart(months[0])).length;

  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary/25 ring-1 ring-inset ring-primary/40" />
          {labels.busy}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-inset ring-primary" />
          {labels.today}
        </span>
        {hiddenPast > 0 && <span>{labels.past.replace('{count}', String(hiddenPast))}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((m) => (
          <Month
            key={m}
            month={m}
            spans={spans}
            today={today}
            monthLabel={monthFmt.format(utcDate(m))}
            dayFmt={dayFmt}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  month,
  spans,
  today,
  monthLabel,
  dayFmt,
  locale,
}: {
  month: number;
  spans: Span[];
  today: number;
  monthLabel: string;
  dayFmt: Intl.DateTimeFormat;
  locale: string;
}) {
  const year = Math.floor(month / 10000);
  const mon = Math.floor((month % 10000) / 100);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();

  // Monday-first: getUTCDay() is 0 for Sunday, so shift it.
  const firstWeekday = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => year * 10000 + mon * 100 + (i + 1)),
  ];

  // The windows that actually touch this month, for the caption underneath.
  const monthFrom = year * 10000 + mon * 100 + 1;
  const monthTo = year * 10000 + mon * 100 + daysInMonth;
  const touching = spans.filter((s) => s.from <= monthTo && s.to > monthFrom);

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-semibold capitalize text-foreground">{monthLabel}</p>

      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-muted-foreground">
        {weekdayInitials(locale).map((d, i) => (
          <div key={i} className="pb-1 font-medium">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const span = spans.find((s) => day >= s.from && day < s.to);
          const isToday = day === today;
          return (
            <div
              key={day}
              // The label lives here rather than in the cell: a day box fits
              // two digits and nothing else, and the summary is usually the
              // same string repeated across thirty of them.
              title={span ? `${dayFmt.format(utcDate(day))} — ${span.summary ?? ''}`.trim() : undefined}
              className={`aspect-square rounded-sm py-0.5 tabular-nums ${
                span ? 'bg-primary/25 font-medium text-foreground' : 'text-muted-foreground'
              } ${isToday ? 'ring-1 ring-inset ring-primary' : ''}`}
            >
              {day % 100}
            </div>
          );
        })}
      </div>

      {/* The labels, said once per window instead of once per day. */}
      {touching.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {touching.map((s, i) => (
            <li key={i} className="truncate">
              <span className="tabular-nums">
                {dayFmt.format(utcDate(s.from))} → {dayFmt.format(utcDate(prevDay(s.to)))}
              </span>
              {s.summary && <span className="text-foreground"> · {s.summary}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── day-number helpers ─────────────────────────────────────────────────────
// All of these work on the YYYYMMDD integers above, so nothing here can be
// shifted by a timezone.

const utcDate = (n: number) =>
  new Date(Date.UTC(Math.floor(n / 10000), Math.floor((n % 10000) / 100) - 1, n % 100));

const monthStart = (n: number) => Math.floor(n / 100) * 100 + 1;

/** The day before an exclusive end, for display as an inclusive range. */
function prevDay(n: number): number {
  const d = utcDate(n);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayNum(d);
}

function monthsBetween(from: number, to: number, cap: number): number[] {
  const out: number[] = [];
  const d = utcDate(monthStart(from));
  const end = utcDate(monthStart(to));
  while (d <= end && out.length < cap) {
    out.push(dayNum(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out.length ? out : [monthStart(from)];
}

function weekdayInitials(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  // 2024-01-01 was a Monday, which is where this grid starts.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
}
