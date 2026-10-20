"use client";

// Google map of serviceable areas — pin + extent rectangle per area.
// Client-only (imported via next/dynamic ssr:false from areas-board.tsx).

import { useEffect, useRef } from "react";
import { AdvancedMarker, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { MapsProvider } from "@/components/maps-provider";
import { GOOGLE_MAP_ID, INACTIVE_GREY, PinGlyph, ROOME_BLUE, ROOME_BLUE_DARK } from "@/lib/google-maps";
import type { ServiceableArea } from "@/lib/serviceable-areas";

const ITALY_CENTER = { lat: 42.5, lng: 12.5 };

// Fit to all areas; pan to the selected one when it changes.
function ViewController({ areas, selectedId }: { areas: ServiceableArea[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (selectedId) {
      const a = areas.find((x) => x.id === selectedId);
      if (a && a.lat != null && a.lng != null) {
        map.panTo({ lat: a.lat, lng: a.lng });
        const z = map.getZoom() ?? 5;
        if (z < 11) map.setZoom(11);
        return;
      }
    }
    const pts = areas.filter((a) => a.lat != null && a.lng != null);
    if (pts.length === 0) {
      map.setCenter(ITALY_CENTER);
      map.setZoom(5);
    } else if (pts.length === 1) {
      map.setCenter({ lat: pts[0].lat as number, lng: pts[0].lng as number });
      map.setZoom(11);
    } else {
      const bounds = new google.maps.LatLngBounds();
      for (const a of pts) bounds.extend({ lat: a.lat as number, lng: a.lng as number });
      map.fitBounds(bounds, 44);
      const once = map.addListener("idle", () => {
        const z = map.getZoom();
        if (z !== undefined && z > 12) map.setZoom(12);
        once.remove();
      });
    }
  }, [map, areas, selectedId]);
  return null;
}

/** The area's extent as a google.maps.Rectangle, kept in sync with its props. */
function ExtentRectangle({
  box,
  color,
  selected,
  onClick,
}: {
  box: NonNullable<ServiceableArea["boundingBox"]>;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const map = useMap();
  const rectRef = useRef<google.maps.Rectangle | null>(null);
  const clickRef = useRef(onClick);
  useEffect(() => {
    clickRef.current = onClick;
  });

  useEffect(() => {
    if (!map) return;
    const rect = new google.maps.Rectangle({
      map,
      bounds: { north: box.maxLat, south: box.minLat, east: box.maxLng, west: box.minLng },
      strokeColor: color,
      strokeWeight: selected ? 2 : 1,
      fillColor: color,
      fillOpacity: selected ? 0.12 : 0.05,
      clickable: true,
    });
    const listener = rect.addListener("click", () => clickRef.current());
    rectRef.current = rect;
    return () => {
      listener.remove();
      rect.setMap(null);
      rectRef.current = null;
    };
  }, [map, box.minLat, box.maxLat, box.minLng, box.maxLng, color, selected]);

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
    <MapsProvider>
      <GoogleMap
        mapId={GOOGLE_MAP_ID}
        defaultCenter={ITALY_CENTER}
        defaultZoom={5}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ViewController areas={withCoords} selectedId={selectedId} />
        {withCoords.map((a) => {
          const selected = a.id === selectedId;
          const color = !a.active ? INACTIVE_GREY : selected ? ROOME_BLUE_DARK : ROOME_BLUE;
          return (
            <span key={a.id}>
              {a.boundingBox && (
                <ExtentRectangle
                  box={a.boundingBox}
                  color={!a.active ? INACTIVE_GREY : ROOME_BLUE}
                  selected={selected}
                  onClick={() => onSelect(a.id)}
                />
              )}
              <AdvancedMarker
                position={{ lat: a.lat as number, lng: a.lng as number }}
                zIndex={selected ? 2 : 1}
                onClick={() => onSelect(a.id)}
                title={a.displayName}
              >
                <PinGlyph color={color} size={selected ? 40 : 28} />
              </AdvancedMarker>
            </span>
          );
        })}
      </GoogleMap>
    </MapsProvider>
  );
}
