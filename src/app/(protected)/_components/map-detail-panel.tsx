'use client';

// Right-hand panel that renders the tapped pin's full record. Three states:
// no selection (hint), loading (spinner), and loaded (property card). Data
// comes from the getListingDetail server action via dashboard-map.tsx.

import Link from 'next/link';
import Image from 'next/image';
import { useT } from '@/i18n/client';
import type { MapListingDetail } from '../actions';

function euros(n: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function MapDetailPanel({
  detail,
  loading,
  hasSelection,
}: {
  detail: MapListingDetail | null;
  loading: boolean;
  hasSelection: boolean;
}) {
  const t = useT();

  if (!hasSelection) {
    return (
      <Centered>
        <p className="text-sm font-medium text-foreground">
          {t('dashboard.detailEmptyTitle')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('dashboard.detailEmptyHint')}
        </p>
      </Centered>
    );
  }

  if (loading) {
    return (
      <Centered>
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-3 text-xs text-muted-foreground">
          {t('dashboard.detailLoading')}
        </p>
      </Centered>
    );
  }

  if (!detail) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.detailNotFound')}
        </p>
      </Centered>
    );
  }

  const cover = detail.photoUrls[0];

  return (
    <div className="flex flex-col">
      <div className="relative h-40 w-full shrink-0 bg-secondary">
        {cover ? (
          <Image
            src={cover}
            alt={detail.addressLine || detail.id}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t('dashboard.detailNoPhoto')}
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            detail.isOnMarket
              ? 'bg-success/90 text-success-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {detail.isOnMarket
            ? t('dashboard.detailOnMarket')
            : t('dashboard.detailOffMarket')}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <header>
          <h3 className="text-sm font-semibold text-foreground">
            {detail.addressLine || '—'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {[detail.city, detail.region].filter(Boolean).join(', ')}
          </p>
          {detail.isApproximate && (
            <p className="mt-1 text-[11px] text-amber-600">
              {t('dashboard.detailApproxLocation')}
            </p>
          )}
        </header>

        {detail.lowestPrice > 0 && (
          <p className="text-sm text-foreground">
            <span className="text-xs text-muted-foreground">
              {t('dashboard.detailFrom')}{' '}
            </span>
            <span className="text-lg font-semibold">
              {euros(detail.lowestPrice)}
            </span>
            <span className="text-xs text-muted-foreground"> /mese</span>
          </p>
        )}

        {detail.description && (
          <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
            {detail.description}
          </p>
        )}

        {detail.rooms.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('dashboard.detailRooms')} · {detail.rooms.length}
            </p>
            <ul className="space-y-1">
              {detail.rooms.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-foreground">
                    {r.type ? r.type : '—'}
                    {r.price > 0 && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {euros(r.price)}
                      </span>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.isFree
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.isFree
                      ? t('dashboard.detailRoomFree')
                      : t('dashboard.detailRoomTaken')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.owner && (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary">
              {detail.owner.photoUrl && (
                <Image
                  src={detail.owner.photoUrl}
                  alt={detail.owner.name ?? 'owner'}
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('dashboard.detailOwner')}
              </p>
              <p className="truncate text-xs font-medium text-foreground">
                {detail.owner.name ?? detail.ownerId.slice(0, 8) + '…'}
              </p>
            </div>
          </div>
        )}

        {detail.ownerId && (
          <Link
            href={`/managed/${detail.ownerId}/operate`}
            className="block rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
          >
            {t('dashboard.detailOpenOperate')}
          </Link>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
