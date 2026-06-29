"use client";

// Leaflet map of serviceable areas — pin + bounding-box rectangle per area.
// Client-only (imported via next/dynamic ssr:false from areas-board.tsx).
// Free OpenStreetMap tiles, matching the dashboard map + the OSM lookup.

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Rectangle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { ServiceableArea } from "@/lib/serviceable-areas";

const ITALY_CENTER: [number, number] = [42.5, 12.5];

function pinIcon(active: boolean, selected: boolean): L.DivIcon {
  const color = !active ? "#94a3b8" : selected ? "#16365c" : "#2563a8";
  const size = selected ? 40 : 28;
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"
         stroke="white" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"
         style="filter: drop-shadow(0 1px 2px rgba(0,0,0,.35));">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html,
    className: "roome-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

// Fit to all areas; fly to the selected one when it changes.
function ViewController({
  areas,
  selectedId,
}: {
  areas: ServiceableArea[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const a = areas.find((x) => x.id === selectedId);
      if (a && a.lat != null && a.lng != null) {
        map.flyTo([a.lat, a.lng], Math.max(map.getZoom(), 11), {
          duration: 0.6,
        });
        return;
      }
    }
    const pts = areas
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => [a.lat as number, a.lng as number] as [number, number]);
    if (pts.length === 0) {
      map.setView(ITALY_CENTER, 5);
    } else if (pts.length === 1) {
      map.setView(pts[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(pts), { padding: [44, 44], maxZoom: 12 });
    }
  }, [map, areas, selectedId]);
  return null;
}

export default function AreasMap({
  areas,
  selectedId,
  onSelect,
}: {
  areas: ServiceableArea[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const withCoords = areas.filter((a) => a.lat != null && a.lng != null);

  return (
    <MapContainer
      center={ITALY_CENTER}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ViewController areas={withCoords} selectedId={selectedId} />
      {withCoords.map((a) => {
        const selected = a.id === selectedId;
        const color = !a.active ? "#94a3b8" : "#2563a8";
        return (
          <Fragment key={a.id}>
            {a.boundingBox && (
              <Rectangle
                bounds={[
                  [a.boundingBox.minLat, a.boundingBox.minLng],
                  [a.boundingBox.maxLat, a.boundingBox.maxLng],
                ]}
                pathOptions={{
                  color,
                  weight: selected ? 2 : 1,
                  fillOpacity: selected ? 0.12 : 0.05,
                }}
                eventHandlers={{ click: () => onSelect(a.id) }}
              />
            )}
            <Marker
              position={[a.lat as number, a.lng as number]}
              icon={pinIcon(a.active, selected)}
              eventHandlers={{ click: () => onSelect(a.id) }}
            />
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
