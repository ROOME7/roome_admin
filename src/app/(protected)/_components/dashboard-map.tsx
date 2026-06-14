'use client';

// Dashboard map orchestrator.
//
// Leaflet touches `window` at import time, so the actual <ListingsMap> is
// pulled in with next/dynamic({ ssr: false }) from inside this Client
// Component (Next 16 forbids ssr:false from Server Components).
//
// Responsibilities: hold the selected pin, lazy-load its full record via the
// getListingDetail server action, and lay the map + right-hand detail panel
// side by side. The marker model carries a `kind` ('listing' | 'user') so a
// user-pin layer can be switched on later without touching the map — today
// the server only emits 'listing' pins (users have no stored coordinates).

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useT } from '@/i18n/client';
import { getListingDetail, type MapListingDetail } from '../actions';
import { MapDetailPanel } from './map-detail-panel';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'listing' | 'user';
  label: string;
  price: number;
  onMarket: boolean;
}

const ListingsMap = dynamic(() => import('./listings-map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

export function DashboardMap({ markers }: { markers: MapMarker[] }) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MapListingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setLoading(true);
    try {
      const d = await getListingDetail(id);
      // Drop a stale response if the admin tapped another pin while this
      // request was in flight — only the most-recently-selected id wins.
      setSelectedId((current) => {
        if (current === id) {
          setDetail(d);
          setLoading(false);
        }
        return current;
      });
    } catch {
      setSelectedId((current) => {
        if (current === id) setLoading(false);
        return current;
      });
    }
  }, []);

  const listingCount = markers.filter((m) => m.kind === 'listing').length;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {/* `isolate` traps Leaflet's high internal z-indexes (panes/controls
          reach 400–800) inside this box so they can't paint over the sticky
          app header. */}
      <div className="relative isolate h-[68vh] overflow-hidden rounded-lg border border-border bg-surface lg:col-span-2">
        {markers.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('dashboard.mapNoCoords')}
          </div>
        ) : (
          <ListingsMap
            markers={markers}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}

        {/* Legend + count, floating over the map. */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-surface/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            {t('dashboard.mapLegendListings')}
            <span className="ml-1 font-semibold">{listingCount}</span>
          </div>
        </div>
      </div>

      <div className="h-[68vh] overflow-y-auto rounded-lg border border-border bg-surface lg:col-span-1">
        <MapDetailPanel
          detail={detail}
          loading={loading}
          hasSelection={selectedId !== null}
        />
      </div>
    </section>
  );
}
