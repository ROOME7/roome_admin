// Shared types + helpers for the Serviceable Areas feature.
//
// No 'server-only' / firebase-admin imports here, so both Server Components
// and Client Components can import the types. The Firestore reads/writes and
// the OpenStreetMap (Nominatim) lookup live in the route's actions.ts.
//
// SCHEMA — `serviceableAreas/{areaId}` (doc id = slug for cities):
// Designed for scale. Today every area is a top-level city (kind:'city',
// level:0, parentAreaId:null), but the shape supports a hierarchy so we can
// add sub-city ZONES later (kind:'zone', level:1, parentAreaId:<citySlug>,
// ancestorIds:[<citySlug>]) WITHOUT a migration — an array-contains query on
// `ancestorIds` then yields a whole city's zones.

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ServiceableArea {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  kind: "city" | "zone";
  parentAreaId: string | null;
  ancestorIds: string[];
  level: number;
  province: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  boundingBox: BoundingBox | null;
  active: boolean;
  sortOrder: number;
  /** Epoch ms (Timestamps are serialized before crossing to the client). */
  createdAt: number | null;
}

/** A place returned by the OSM lookup, ready to be turned into an area. */
export interface PlaceCandidate {
  name: string;
  province: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  boundingBox: BoundingBox | null;
  slug: string;
  osmId: number | null;
  osmType: string | null;
  osmClass: string | null;
  placeRank: number | null;
  displayName: string;
}

/** URL/id-safe slug: lowercased, accent-stripped, non-alphanumerics → '-'. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
