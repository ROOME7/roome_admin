'use client';

// The actual Leaflet map — only ever rendered client-side (imported via
// next/dynamic with ssr:false from dashboard-map.tsx). Uses free OpenStreetMap
// tiles, matching the admin's existing Nominatim/OSM geocoding in the
// create-listing flow (no API key, no billing).

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MapMarker } from './dashboard-map';

// Italy-wide fallback view (roughly Rome) when there are no markers to fit.
const FALLBACK_CENTER: [number, number] = [41.9, 12.5];

// Custom teardrop pin as an inline-SVG divIcon — avoids Leaflet's broken
// default marker-image asset paths under bundlers entirely, and lets us tint
// by kind / selection state.
function pinIcon(kind: MapMarker['kind'], selected: boolean): L.DivIcon {
  const color =
    kind === 'user'
      ? '#d97706' // amber — reserved for the future user-pin layer
      : selected
        ? '#16365c' // roome-blue-dark
        : '#2563a8'; // roome-blue
  const size = selected ? 40 : 30;
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"
         stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"
         style="filter: drop-shadow(0 1px 2px rgba(0,0,0,.35));">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html,
    className: 'roome-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Fits the viewport to all markers once they're available. A child of
// MapContainer so it can grab the map instance via useMap().
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(
      markers.map((m) => [m.lat, m.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
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
  const center: [number, number] = markers.length
    ? [markers[0].lat, markers[0].lng]
    : FALLBACK_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={6}
      scrollWheelZoom
      className="h-full w-full"
      // Leaflet's own panes sit at z-index 400+; keep them under the app's
      // sticky header (z-20 → but Leaflet uses much higher). The floating
      // legend uses z-[1000] to stay above tiles.
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={pinIcon(m.kind, m.id === selectedId)}
          eventHandlers={{ click: () => onSelect(m.id) }}
        />
      ))}
    </MapContainer>
  );
}
