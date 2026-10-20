'use client';

// The dashboard map on Google Maps — rendered client-side only (next/dynamic
// with ssr:false from dashboard-map.tsx). One AdvancedMarker per property,
// fitted to all of them on load.

import { useEffect } from 'react';
import { AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { MapsProvider } from '@/components/maps-provider';
import { GOOGLE_MAP_ID, PinGlyph, ROOME_BLUE, ROOME_BLUE_DARK } from '@/lib/google-maps';
import type { MapMarker } from './dashboard-map';

// Italy-wide fallback view (roughly Rome) when there are no markers to fit.
const FALLBACK_CENTER = { lat: 41.9, lng: 12.5 };

function pinColor(kind: MapMarker['kind'], selected: boolean): string {
  if (kind === 'user') return '#d97706'; // amber — reserved for the future user-pin layer
  return selected ? ROOME_BLUE_DARK : ROOME_BLUE;
}

// Fits the viewport to all markers once they're available.
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const m of markers) bounds.extend({ lat: m.lat, lng: m.lng });
    map.fitBounds(bounds, 48);
    // Leaflet had maxZoom on the fit; Google has none, so clamp afterwards.
    const once = map.addListener('idle', () => {
      const z = map.getZoom();
      if (z !== undefined && z > 15) map.setZoom(15);
      once.remove();
    });
  }, [map, markers]);
  return null;
}

export default function ListingsMap({
  markers,
  selectedId,
  onSelect,
}: {
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const center = markers.length ? { lat: markers[0].lat, lng: markers[0].lng } : FALLBACK_CENTER;

  return (
    <MapsProvider>
      <GoogleMap
        mapId={GOOGLE_MAP_ID}
        defaultCenter={center}
        defaultZoom={6}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitBounds markers={markers} />
        {markers.map((m) => {
          const selected = m.id === selectedId;
          return (
            <AdvancedMarker
              key={m.id}
              position={{ lat: m.lat, lng: m.lng }}
              zIndex={selected ? 2 : 1}
              onClick={() => onSelect(m.id)}
              title={m.label}
            >
              <PinGlyph color={pinColor(m.kind, selected)} size={selected ? 40 : 30} />
            </AdvancedMarker>
          );
        })}
      </GoogleMap>
    </MapsProvider>
  );
}
