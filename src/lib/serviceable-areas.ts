// Shared types + helpers for the Serviceable Areas feature.
//
// No 'server-only' import here, so both Server and Client Components can use
// the types. The API calls live in the route's actions.ts.
//
// ⚠️ THE SHAPE IS THE API'S NOW, not a Firestore document's. `GET
// /admin/areas` returns every area — switched-off ones included — each with
// how much is riding on it: live properties and interested tenants. Those
// counts are the point of the screen. Deactivating a city with 40 properties
// is a different decision from deactivating one with none, and the old board
// showed neither.
//
// The hierarchy fields (`kind`, `level`, `parentAreaId`) are carried through
// unused: every area today is a top-level city, and the column exists so
// sub-city zones can arrive without a migration.

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
  level: number;
  province: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  boundingBox: BoundingBox | null;
  active: boolean;
  sortOrder: number;
  /** Epoch ms — Dates are serialized before crossing to the client. */
  createdAt: number | null;
  /** Live properties in this area. What makes removing it expensive. */
  propertyCount: number;
  /** Tenants who said they want to live here. */
  interestedTenants: number;
}

/**
 * A city tenants asked for that Roome does not cover.
 *
 * These exist because tenant interest is stored as a plain slug rather than a
 * foreign key, so a request for somewhere unserved survives instead of being
 * rejected at write time. It is the only expansion signal the product has.
 */
export interface UnservedDemand {
  slug: string;
  tenants: number;
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
