'use client';

// The table, its selection, and the confirmation.
//
// ⚠️ THE ONLY CLIENT COMPONENT ON THIS SCREEN, and it is one because bulk
// selection genuinely needs state: the button has to say how many rows are
// picked before you press it, and a checkbox that only exists in the DOM
// cannot tell you that. Everything else here — the tabs, the search, the next
// page — stays a link or a plain GET form, as on the users screen.

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
// Aliased, not relative: this screen lives in the `(wide)` route group and
// the dialog primitives live under `(protected)/managed`, so a relative path
// would have to climb out of one group and into another. Twelve other files
// import these from inside `managed`, so the primitives stay where they are.
import { Overlay } from '@/app/(protected)/managed/_components/dialog-primitives';
import { deleteProperties, restoreProperty } from '../actions';
import type { TFunc } from '@/i18n/t';
import type { PropertyRow } from '../_lib/types';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const STATUS_STYLES: Record<PropertyRow['status'], string> = {
  on_market: 'bg-primary/10 text-primary',
  off_market: 'bg-secondary text-muted-foreground',
  deleted: 'bg-destructive/10 text-destructive',
};

const STATUS_KEYS: Record<PropertyRow['status'], string> = {
  on_market: 'listings.statusOnMarket',
  off_market: 'listings.statusOffMarket',
  deleted: 'listings.statusDeleted',
};

type Notice = { tone: 'ok' | 'error'; text: string } | null;

export default function ListingsTable({ rows }: { rows: PropertyRow[] }) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  // Deleted rows are not selectable: the bulk action would be a no-op on them
  // and including them in "select all" makes the count in the confirmation
  // dialog lie about what is going to happen.
  const selectable = useMemo(() => rows.filter((r) => r.status !== 'deleted'), [rows]);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  const chosen = useMemo(
    () => selectable.filter((r) => selected.has(r.id)),
    [selectable, selected],
  );
  const withContracts = chosen.filter((r) => r.contractCount > 0).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.id)),
    );
  }

  function runDelete() {
    const ids = chosen.map((r) => r.id);
    startTransition(async () => {
      const res = await deleteProperties(ids);
      setConfirming(false);
      if (!res.ok) {
        setNotice({ tone: 'error', text: res.error });
        return;
      }
      setSelected(new Set());
      const parts = [
        res.deleted === 1
          ? t('listings.resultDeletedOne')
          : t('listings.resultDeleted', { count: res.deleted }),
      ];
      if (res.alreadyDeleted > 0) {
        parts.push(t('listings.resultSkipped', { count: res.alreadyDeleted }));
      }
      setNotice({ tone: 'ok', text: parts.join(' ') });
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const res = await restoreProperty(id);
      setNotice(
        res.ok
          ? { tone: 'ok', text: t('listings.resultRestored') }
          : { tone: 'error', text: res.error },
      );
    });
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'ok'
              ? 'border-border bg-surface text-foreground'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* The bulk bar only exists when it has something to do. A permanently
          visible "Delete selected (0)" is a disabled control that teaches
          nobody anything. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {t('listings.selected', { count: selected.size })}
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('listings.clearSelection')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="ml-auto rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t('listings.deleting') : t('listings.deleteSelected')}
          </button>
        </div>
      )}

      {/* ⚠️ A GRID, NOT CARDS. This screen is read the way a spreadsheet is —
          scanned down one column looking for the odd one out — so every cell
          holds a single value, rows are one line tall, and the columns are
          ruled. The old layout stacked city under street and email under
          owner, which reads well for five rows and defeats the purpose at a
          hundred. `border-separate` with zero spacing keeps the ruled borders
          from collapsing away under the sticky header. */}
      <div className="overflow-x-auto border-y border-border bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {/* `top-14` is the height of the panel's own sticky header; the
                two stack rather than overlap. */}
            <tr className="sticky top-14 z-10 bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-9 border-b border-r border-border px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                  aria-label={t('listings.selectAll')}
                  className="h-3.5 w-3.5 rounded border-border align-middle"
                />
              </th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colProperty')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colCity')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colOwner')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colEmail')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 text-right font-semibold">{t('listings.colRooms')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 text-right font-semibold">{t('listings.colListed')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colIcal')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 text-right font-semibold">{t('listings.colContracts')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colStatus')}</th>
              <th className="border-b border-r border-border px-2 py-1.5 font-semibold">{t('listings.colCreated')}</th>
              <th className="border-b border-border px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`${i % 2 ? 'bg-secondary/30' : ''} hover:bg-primary/5`}
              >
                <td className="border-b border-r border-border px-2 py-1">
                  {row.status !== 'deleted' && (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={row.title}
                      className="h-3.5 w-3.5 rounded border-border align-middle"
                    />
                  )}
                </td>
                <td className="max-w-[22rem] truncate border-b border-r border-border px-2 py-1">
                  <Link
                    href={`/listings/${row.id}`}
                    title={row.title}
                    className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {row.title}
                  </Link>
                  {row.source && (
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {t('listings.fromImport')}
                    </span>
                  )}
                </td>
                <td className="max-w-[10rem] truncate border-b border-r border-border px-2 py-1 text-muted-foreground">
                  {row.city}
                  {row.province ? ` (${row.province})` : ''}
                </td>
                <td className="max-w-[12rem] truncate border-b border-r border-border px-2 py-1 text-foreground">
                  {row.owner.name ?? `@${row.owner.username}`}
                </td>
                <td className="max-w-[16rem] truncate border-b border-r border-border px-2 py-1 text-muted-foreground">
                  {row.owner.email}
                </td>
                {/* Tabular figures so the digits line up down the column —
                    the whole reason to put a number in its own cell. */}
                <td className="border-b border-r border-border px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {row.roomCount}
                </td>
                <td className="border-b border-r border-border px-2 py-1 text-right tabular-nums text-muted-foreground">
                  {row.activeListings || ''}
                </td>
                <td className="border-b border-r border-border px-2 py-1">
                  <IcalCell row={row} t={t} />
                </td>
                {/* Still the one fact worth colouring: a non-zero here means
                    deleting the row reaches a real person who applied. */}
                <td
                  className={`border-b border-r border-border px-2 py-1 text-right tabular-nums ${
                    row.contractCount > 0 ? 'font-semibold text-amber-700' : 'text-muted-foreground'
                  }`}
                >
                  {row.contractCount || ''}
                </td>
                <td className="border-b border-r border-border px-2 py-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[row.status]}`}
                  >
                    {t(STATUS_KEYS[row.status])}
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-r border-border px-2 py-1 tabular-nums text-muted-foreground">
                  {dateFormatter.format(row.createdAt)}
                </td>
                <td className="whitespace-nowrap border-b border-border px-2 py-1 text-right">
                  {row.status === 'deleted' ? (
                    <button
                      type="button"
                      onClick={() => runRestore(row.id)}
                      disabled={pending}
                      className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      {pending ? t('listings.restoring') : t('listings.restore')}
                    </button>
                  ) : (
                    <Link
                      href={`/listings/${row.id}`}
                      className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      {t('listings.view')}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirming && (
        <Overlay onClose={() => !pending && setConfirming(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">
              {chosen.length === 1
                ? t('listings.confirmTitleOne')
                : t('listings.confirmTitle', { count: chosen.length })}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('listings.confirmBody')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('listings.confirmReversible')}</p>
            {/* The one thing worth interrupting for. Everything else on this
                screen is recoverable and unremarkable; this says a real person
                is attached to what you are about to remove. */}
            {withContracts > 0 && (
              <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700">
                {t('listings.confirmWarning', { count: withContracts })}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {t('listings.confirmCancel')}
              </button>
              <button
                type="button"
                onClick={runDelete}
                disabled={pending}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? t('listings.deleting') : t('listings.confirmDelete')}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/**
 * The iCal cell.
 *
 * ⚠️ THREE STATES, NOT TWO. "Has a feed" and "has a working feed" are
 * different facts and the gap between them is where the support tickets live:
 * the sync is a nightly cron at 05:00 Europe/Rome, so a landlord who saves a
 * URL in the evening has an attached feed that has produced nothing until
 * morning. Showing a bare tick there claims a sync that has not happened;
 * showing a cross calls a working feed broken. So `pending` is its own state,
 * and it is the one that stops somebody "fixing" a feed that was fine.
 */
function IcalCell({ row, t }: { row: PropertyRow; t: TFunc }) {
  if (!row.hasIcal) return <span className="text-muted-foreground">—</span>;

  if (row.icalNeverSynced) {
    return (
      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {t('listings.icalPending')}
      </span>
    );
  }

  return (
    <span
      // The date is the evidence behind the tick, and a title is the right
      // weight for it: visible on demand, not taking a column of its own.
      title={row.icalLastSyncedAt ? dateFormatter.format(new Date(row.icalLastSyncedAt)) : undefined}
      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
    >
      {t('listings.icalYes')}
      {row.icalRooms > 1 && <span className="ml-1 font-normal">×{row.icalRooms}</span>}
    </span>
  );
}
