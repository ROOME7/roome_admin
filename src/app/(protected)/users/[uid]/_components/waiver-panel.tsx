'use client';

// Comp a landlord's publishing subscription, or withdraw the comp.
//
// ⚠️ WHY THIS EXISTS AT ALL. The paid gate is satisfied by an active
// subscription OR an admin waiver. With the server on live Stripe keys, the
// only other way to put a landlord on the market is a real card and a real
// charge — so this is how a partner, an early landlord, or anyone the
// business decided not to bill gets to publish.
//
// A Client Component because the grant needs a reason typed into it and a
// confirmation before it fires; a form that posts and hopes cannot tell you
// what it is about to do.

import { useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
import type { TFunc } from '@/i18n/t';
import { setSubscriptionWaiver } from '../actions';

export interface WaiverState {
  active: boolean;
  reason: string | null;
  grantedAt: string | null;
  grantedBy: string | null;
  expiresAt: string | null;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : null);

export default function WaiverPanel({
  userId,
  waiver,
  isLandlord,
}: {
  userId: string;
  waiver: WaiverState;
  /** The gate does not exist for a tenant, so neither does this control. */
  isLandlord: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(waived: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setSubscriptionWaiver(userId, { waived, reason, expiresAt: expiresAt || undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setReason('');
      setExpiresAt('');
    });
  }

  if (!isLandlord && !waiver.active) {
    return (
      <p className="text-sm text-muted-foreground sm:col-span-2">
        {t('users.waiverTenantsNotApplicable')}
      </p>
    );
  }

  return (
    <div className="sm:col-span-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            waiver.active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {waiver.active ? t('users.waiverOn') : t('users.waiverOff')}
        </span>

        {waiver.active ? (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {pending ? t('users.waiverWorking') : t('users.waiverRevoke')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t('users.waiverGrant')}
          </button>
        )}
      </div>

      {/* What the waiver currently says. Shown only when there is one, so an
          account with no comp does not display a row of empty labels. */}
      {waiver.active && (
        <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <Detail label={t('users.waiverReason')} value={waiver.reason} />
          <Detail
            label={t('users.waiverExpires')}
            value={fmtDate(waiver.expiresAt) ?? t('users.waiverNoExpiry')}
          />
          <Detail label={t('users.waiverGrantedAt')} value={fmtDate(waiver.grantedAt)} />
          <Detail label={t('users.waiverGrantedBy')} value={waiver.grantedBy} mono />
        </dl>
      )}

      {open && !waiver.active && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t('users.waiverReasonLabel')}</span>
            <input
              id="waiver-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={t('users.waiverReasonPlaceholder')}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {/* Required by the API, and said here so the refusal is not the
                first time anybody hears about it. */}
            <span className="text-xs text-muted-foreground">{t('users.waiverReasonHelp')}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t('users.waiverExpiresLabel')}</span>
            <input
              id="waiver-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-fit rounded-md border border-border bg-bg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <span className="text-xs text-muted-foreground">{t('users.waiverExpiresHelp')}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending || !reason.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t('users.waiverWorking') : t('users.waiverConfirm')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('common.cancel')}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">{t('users.waiverNoStripe')}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
