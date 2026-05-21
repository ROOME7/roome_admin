'use client';

// Tenants tab on the Operate page. Shows who is currently living in the
// partner's properties (active contracts), grouped by house, and lets the
// admin end a tenancy on the partner's behalf — the admin-side equivalent
// of the Flutter landlord_tenants_screen (2026-05-19 client feedback).

import { useState, useTransition } from 'react';
import { removeTenantAs } from '../actions';
import type { OperateActiveTenant } from '../actions';
import { InputStyles, Overlay } from '../../../_components/dialog-primitives';
import { useT } from '@/i18n/client';

export function TenantsTab({
  uid,
  tenants,
  disabled,
}: {
  uid: string;
  tenants: OperateActiveTenant[];
  disabled: boolean;
}) {
  const t = useT();
  if (tenants.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {t('operate.tenantsEmpty')}
        </p>
      </section>
    );
  }

  // Group by property so the admin reads it house-by-house.
  const groups = new Map<string, OperateActiveTenant[]>();
  for (const tenant of tenants) {
    const key = tenant.propertyId || tenant.propertyLabel;
    const list = groups.get(key);
    if (list) list.push(tenant);
    else groups.set(key, [tenant]);
  }

  return (
    <div className="space-y-6">
      {[...groups.values()].map((group) => (
        <section key={group[0].propertyId || group[0].propertyLabel}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{group[0].propertyLabel}</span>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {group.length} {group.length === 1 ? t('operate.tenantsSingular') : t('operate.tenantsPlural')}
            </span>
          </h3>
          <ul className="space-y-2">
            {group.map((t) => (
              <li key={t.contractId}>
                <TenantRow uid={uid} tenant={t} disabled={disabled} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
      {initial}
    </div>
  );
}

function TenantRow({
  uid,
  tenant,
  disabled,
}: {
  uid: string;
  tenant: OperateActiveTenant;
  disabled: boolean;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  const username = tenant.profile?.displayName ?? tenant.tenantUsername;
  const fullName = [tenant.profile?.name, tenant.profile?.surname]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .trim();
  const headline = fullName || username || '(tenant)';
  const showUsernameLine = fullName.length > 0 && username.length > 0;
  const subtitleBits = [
    tenant.profile?.age != null ? `${tenant.profile.age} yrs` : null,
    tenant.profile?.profession,
  ].filter(Boolean);

  return (
    <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <Avatar url={tenant.profile?.photoUrl ?? null} name={headline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {headline}
          </span>
          {tenant.terminationRequested && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {t('operate.tenantMoveOutRequested')}
            </span>
          )}
        </div>
        {showUsernameLine && (
          <p className="truncate text-xs font-medium text-muted-foreground">
            @{username.replace(/^@/, '')}
          </p>
        )}
        {subtitleBits.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {subtitleBits.join(' · ')}
          </p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {t('operate.tenantRoom')} {tenant.roomId || '—'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="shrink-0 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('operate.tenantEndTenancyButton')}
      </button>
      {confirming && (
        <RemoveTenantDialog
          uid={uid}
          tenant={tenant}
          headline={headline}
          onClose={() => setConfirming(false)}
        />
      )}
    </article>
  );
}

function RemoveTenantDialog({
  uid,
  tenant,
  headline,
  onClose,
}: {
  uid: string;
  tenant: OperateActiveTenant;
  headline: string;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await removeTenantAs(uid, tenant.contractId);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{t('operate.endTenancyTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('operate.endTenancyDesc', {
            tenant: headline,
            property: tenant.propertyLabel,
            field: '_impersonatedByAdminUid',
          })}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('operate.endTenancyEndingButton') : t('operate.endTenancyConfirmButton')}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
