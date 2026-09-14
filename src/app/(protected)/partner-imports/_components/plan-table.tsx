'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import type { ImportPlan, PropertyPlan, RoomPlan } from '../_lib/types';

/**
 * Every property the file produces, and its rooms on demand.
 *
 * ⚠️ THE BLOCKED ROWS ARE NOT HIDDEN. A room that cannot be published still
 * imports — one partner's whole file has no prices and their value to us is
 * the calendar — so the reason is shown against the row rather than filtered
 * out of a list that would then look complete.
 */
export function PlanTable({ plan }: { plan: ImportPlan }) {
  const t = useT();

  if (plan.properties.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {plan.fileIssues[0] ?? 'This file produced no rows.'}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
        {t('partnerImports.rowsTitle')}
      </h2>
      <ul className="divide-y divide-border">
        {plan.properties.map((property) => (
          <PropertyRow key={property.key} property={property} />
        ))}
      </ul>
    </section>
  );
}

function PropertyRow({ property }: { property: PropertyPlan }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const blocked = property.rooms.filter((r) => r.blockers.length > 0).length;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{property.label}</span>
            <ActionChip action={property.action} />
            {property.externalRef && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {property.externalRef}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {addressOf(property)} · {t('partnerImports.roomsCount', { count: property.rooms.length })}
            {property.changes.length > 0 &&
              ` · ${t('partnerImports.changesCount', { count: property.changes.length })}`}
            {blocked > 0 && ` · ${t('partnerImports.summaryBlocked', { count: blocked })}`}
          </p>
          {property.blockers.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">{property.blockers.join(' · ')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {open ? t('partnerImports.hideRooms') : t('partnerImports.showRooms')}
        </button>
      </div>

      {open && (
        <ul className="mt-3 space-y-1.5 border-l-2 border-border pl-4">
          {property.rooms.map((room) => (
            <RoomRow key={`${room.sheet}:${room.row}:${room.label}`} room={room} />
          ))}
        </ul>
      )}
    </li>
  );
}

function RoomRow({ room }: { room: RoomPlan }) {
  const t = useT();
  const price = room.values['room.priceCents'];

  return (
    <li className="text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-foreground">{room.label}</span>
        <ActionChip action={room.action} />
        {typeof price === 'number' && price > 0 && (
          <span className="tabular-nums text-muted-foreground">
            €{(price / 100).toLocaleString('it-IT')}
          </span>
        )}
        {room.hasCalendarFeed && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {t('partnerImports.hasCalendar')}
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">
          {room.sheet}:{room.row}
        </span>
      </p>

      {room.changes.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {room.changes
            .map((c) => `${short(c.field)}: ${display(c.from)} → ${display(c.to)}`)
            .join(' · ')}
        </p>
      )}

      {/* The reasons a row cannot be published, and the cells that could not
          be read. Both are what the reviewer is here to see. */}
      {room.blockers.length > 0 && (
        <p className="mt-0.5 text-xs text-amber-700">{room.blockers.join(' · ')}</p>
      )}
      {room.issues
        .filter((i) => i.level === 'note')
        .map((i, idx) => (
          <p key={idx} className="mt-0.5 text-xs text-muted-foreground">
            {short(i.field)}: {i.message}
          </p>
        ))}
    </li>
  );
}

function ActionChip({ action }: { action: string }) {
  const t = useT();
  const map: Record<string, { key: string; cls: string }> = {
    create: { key: 'partnerImports.actionCreate', cls: 'bg-primary/10 text-primary' },
    update: { key: 'partnerImports.actionUpdate', cls: 'bg-amber-500/10 text-amber-700' },
    unchanged: { key: 'partnerImports.actionUnchanged', cls: 'bg-secondary text-muted-foreground' },
    blocked: { key: 'partnerImports.blockedLabel', cls: 'bg-destructive/10 text-destructive' },
  };
  const chip = map[action] ?? map.unchanged;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${chip.cls}`}
    >
      {t(chip.key)}
    </span>
  );
}

function addressOf(property: PropertyPlan): string {
  const street = property.values['property.street'];
  const civic = property.values['property.civic'];
  const city = property.values['property.city'];
  return [[street, civic].filter(Boolean).join(' '), city].filter(Boolean).join(', ') || '—';
}

function short(field: string): string {
  return field.replace(/^(property|room)\./, '');
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
}
