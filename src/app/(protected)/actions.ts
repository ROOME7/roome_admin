'use server';

// Dashboard map — server actions.
//
// The map renders lightweight markers (id + lat/lng + a short label) loaded
// with the page. When the admin taps a pin, the client calls
// getListingDetail() to pull the full property record on demand, so we never
// ship every property's photos/rooms/owner up-front.
//
// Read-only. Admin-session gating happens in the (protected) layout; these
// run under the admin's verified session. Mirrors the property/room/owner
// shape used by managed/[uid]/operate and the public roome_listings site.

import { serverDb } from '@/lib/firebase-admin';

export interface MapRoom {
  id: string;
  type: 'single' | 'double' | 'master' | null;
  /** Monthly rent per person, euros. */
  price: number;
  isFree: boolean;
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
  isApproximate: boolean;
  lat: number | null;
  lng: number | null;
  photoUrls: string[];
  rooms: MapRoom[];
  owner: { name: string | null; photoUrl: string | null } | null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

function roomType(v: unknown): MapRoom['type'] {
  return v === 'single' || v === 'double' || v === 'master' ? v : null;
}

async function loadOwner(
  ownerId: string,
): Promise<MapListingDetail['owner']> {
  if (!ownerId) return null;
  try {
    const snap = await serverDb()
      .collection('userProfiles')
      .doc(ownerId)
      .get();
    if (!snap.exists) return null;
    const d = snap.data() ?? {};
    const name =
      asString(d.name) ||
      [asString(d.name), asString(d.surname)].filter(Boolean).join(' ') ||
      asString(d.username) ||
      asString(d.displayName);
    const photoUrl = asString(d.photoUrl) || asString(d.profilePicture);
    return { name: name || null, photoUrl: photoUrl || null };
  } catch {
    return null;
  }
}

export async function getListingDetail(
  propertyId: string,
): Promise<MapListingDetail | null> {
  if (typeof propertyId !== 'string' || !propertyId) return null;

  const db = serverDb();
  const propRef = db.collection('properties').doc(propertyId);
  const propSnap = await propRef.get();
  if (!propSnap.exists) return null;

  const d = propSnap.data() ?? {};
  if (d.deletedAt) return null;

  const [roomsSnap, owner] = await Promise.all([
    propRef.collection('rooms').get(),
    loadOwner(asString(d.ownerId)),
  ]);

  const rooms: MapRoom[] = roomsSnap.docs.map((doc) => {
    const r = doc.data() ?? {};
    const occupied = r.isFree === false || r.status === 'occupied';
    return {
      id: doc.id,
      type: roomType(r.type),
      price: asNumber(r.price) ?? 0,
      isFree: !occupied,
    };
  });

  // `address` is the street string, `civic` the street number.
  const addressLine = [asString(d.address), asString(d.civic)]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: propertyId,
    ownerId: asString(d.ownerId),
    addressLine,
    city: asString(d.city),
    region: asString(d.region),
    description: asString(d.infoHouse) || asString(d.description),
    lowestPrice: asNumber(d.lowestPrice) ?? 0,
    isOnMarket: d.isOnMarket !== false,
    isApproximate: d.isApproximate === true,
    lat: asNumber(d.latitude),
    lng: asNumber(d.longitude),
    photoUrls: asStringArray(d.photoUrls),
    rooms,
    owner,
  };
}
