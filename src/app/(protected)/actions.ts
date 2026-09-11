'use server';

// Dashboard map — server actions.
//
// The map renders lightweight markers (id + lat/lng + a short label) loaded
// with the page. When the admin taps a pin, this pulls the full property
// record on demand, so the page never ships every property's photos, rooms and
// owner up front.
//
// ⚠️ THE PIN IS A PROPERTY ID, NOT A LISTING ID. `GET /listings/:id` is the
// public endpoint and takes the listing — which off-market properties do not
// have. Those are precisely the pins an admin most wants to click.
//
// Read-only. The (protected) layout gates the page; this re-checks the session
// because a Server Action is its own entry point, and the API checks the role
// again on top of that.

import 'server-only';
import { requireAdminSession } from '@/lib/auth';
import { apiAuthed } from '@/lib/session';

export interface MapRoom {
  id: string;
  name: string | null;
  type: string | null;
  /** Monthly rent per person, euros. */
  price: number;
  isFree: boolean;
  isPublished: boolean;
}

export interface MapListingDetail {
  id: string;
  ownerId: string;
  addressLine: string;
  city: string;
  region: string;
  description: string;
  lowestPrice: number;
  isOnMarket: boolean;
  isPublished: boolean;
  isApproximate: boolean;
  lat: number | null;
  lng: number | null;
  photoUrls: string[];
  rooms: MapRoom[];
  owner: { name: string | null; photoUrl: string | null } | null;
}

interface ApiProperty {
  id: string;
  ownerId: string;
  addressLine: string;
  city: string;
  province: string | null;
  region: string | null;
  description: string | null;
  lowestPriceCents: number;
  isOnMarket: boolean;
  isPublished: boolean;
  isApproximate: boolean;
  lat: number | null;
  lng: number | null;
  photoUrls: string[];
  rooms: {
    id: string;
    name: string | null;
    type: string;
    status: string;
    priceCents: number;
    bedCount: number;
    occupiedBeds: number;
    isFree: boolean;
    isPublished: boolean;
  }[];
  owner: { id: string; name: string; email: string; photoUrl: string | null };
}

/** Cents on the wire, euros on screen — rounded once, here. */
function euros(cents: number): number {
  return Math.round(cents / 100);
}

export async function getListingDetail(
  propertyId: string,
): Promise<MapListingDetail | null> {
  await requireAdminSession();
  if (typeof propertyId !== 'string' || !propertyId) return null;

  // A deleted or unknown property comes back as a 404, which `apiAuthed` turns
  // into null — the panel shows "nothing to see" rather than an error.
  const p = await apiAuthed<ApiProperty>(
    `/admin/stats/map/${encodeURIComponent(propertyId)}`,
  );
  if (!p) return null;

  return {
    id: p.id,
    ownerId: p.ownerId,
    addressLine: p.addressLine,
    city: p.city,
    region: p.region ?? '',
    description: p.description ?? '',
    lowestPrice: euros(p.lowestPriceCents),
    isOnMarket: p.isOnMarket,
    isPublished: p.isPublished,
    isApproximate: p.isApproximate,
    lat: p.lat,
    lng: p.lng,
    photoUrls: p.photoUrls,
    rooms: p.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      price: euros(r.priceCents),
      isFree: r.isFree,
      isPublished: r.isPublished,
    })),
    owner: { name: p.owner.name || null, photoUrl: p.owner.photoUrl },
  };
}
