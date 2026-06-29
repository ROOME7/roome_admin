"use server";

// Serviceable Areas — server actions (admin-only).
//
//   searchPlaces        OSM/Nominatim lookup for Italian settlements
//   createServiceableArea  store a chosen place as a serviceable area
//   setAreaActive       toggle an area on/off (tenants only see active ones)
//   deleteServiceableArea  remove an area
//
// Writes go through firebase-admin (bypasses Firestore rules); reads by the
// app/tenants are gated by the public-read rule on `serviceableAreas`.

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { serverDb } from "@/lib/firebase-admin";
import { requireAdminSession } from "@/lib/auth";
import { slugify, type PlaceCandidate } from "@/lib/serviceable-areas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Nominatim usage policy requires a descriptive User-Agent identifying the app.
const USER_AGENT = "RoomeAdmin/1.0 (https://roomeapp.it)";

// OSM "place" types we treat as selectable settlements.
const SETTLEMENT_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "suburb",
]);

interface OsmResult {
  osm_id?: number;
  osm_type?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  place_rank?: number;
  importance?: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
  address?: Record<string, string>;
}

// Keep only actual settlements. We match on `addresstype` (city/town/village/…)
// rather than place_rank so province/region boundaries (addresstype 'county',
// 'state') are excluded — otherwise searching "Milano" also surfaces the
// Metropolitan City of Milan, which isn't something a tenant picks.
function isSettlement(r: OsmResult): boolean {
  if (r.addresstype && SETTLEMENT_TYPES.has(r.addresstype)) return true;
  if (r.category === "place" && r.type && SETTLEMENT_TYPES.has(r.type))
    return true;
  return false;
}

function toCandidate(r: OsmResult): PlaceCandidate {
  const a = r.address ?? {};
  const name =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    r.name ||
    r.display_name.split(",")[0].trim();

  // Italian province code lives in the ISO3166-2 lvl6 tag (e.g. "IT-BO").
  const iso = a["ISO3166-2-lvl6"] || a["ISO3166-2-lvl5"] || "";
  const province = (iso.includes("-") ? iso.split("-")[1] : "") || a.county || "";

  const bb =
    r.boundingbox && r.boundingbox.length === 4
      ? {
          minLat: parseFloat(r.boundingbox[0]),
          maxLat: parseFloat(r.boundingbox[1]),
          minLng: parseFloat(r.boundingbox[2]),
          maxLng: parseFloat(r.boundingbox[3]),
        }
      : null;

  return {
    name,
    province,
    region: a.state || "",
    country: (a.country_code || "it").toUpperCase(),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    boundingBox: bb,
    slug: slugify(name),
    osmId: r.osm_id ?? null,
    osmType: r.osm_type ?? null,
    osmClass: r.category ?? null,
    placeRank: r.place_rank ?? null,
    displayName: r.display_name,
  };
}

export async function searchPlaces(
  query: string,
): Promise<Result<PlaceCandidate[]>> {
  await requireAdminSession();
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "it"); // Italy-only
  url.searchParams.set("accept-language", "it");
  url.searchParams.set("limit", "10");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `OSM lookup failed (${res.status}).` };
    const raw = (await res.json()) as OsmResult[];
    // Best matches first (OSM importance), then dedupe distinct OSM places.
    const settlements = raw
      .filter(isSettlement)
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
    // Dedupe by name+province (not osm_id): OSM often returns the city plus a
    // same-named hamlet in the same province, which look identical to the
    // admin. Sorted by importance, so the real city (kept first) wins.
    const seen = new Set<string>();
    const candidates: PlaceCandidate[] = [];
    for (const r of settlements) {
      const c = toCandidate(r);
      if (!c.slug || !Number.isFinite(c.lat) || !Number.isFinite(c.lng))
        continue;
      const key = `${c.slug}|${c.province}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(c);
    }
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Could not reach the OSM lookup service." };
  }
}

export async function createServiceableArea(
  candidate: PlaceCandidate,
): Promise<Result> {
  const session = await requireAdminSession();
  if (
    !candidate ||
    !candidate.name ||
    !Number.isFinite(candidate.lat) ||
    !Number.isFinite(candidate.lng)
  ) {
    return { ok: false, error: "Invalid place data." };
  }
  const slug = slugify(candidate.name);
  if (!slug) return { ok: false, error: "Could not derive a slug for this place." };

  const db = serverDb();
  // Default doc id is the slug. If a *different* place already holds that slug
  // (same name, different province — common in Italy), disambiguate with the
  // province code so both can coexist and ids stay stable.
  let areaId = slug;
  let ref = db.collection("serviceableAreas").doc(areaId);
  const existing = await ref.get();
  if (existing.exists) {
    const sameOsm =
      candidate.osmId != null &&
      (existing.data()?.osm as { id?: number } | undefined)?.id ===
        candidate.osmId;
    if (sameOsm) {
      return { ok: false, error: `"${candidate.name}" is already in the list.` };
    }
    const suffix = candidate.province
      ? candidate.province.toLowerCase()
      : String(candidate.osmId ?? Date.now());
    areaId = `${slug}-${suffix}`;
    ref = db.collection("serviceableAreas").doc(areaId);
    if ((await ref.get()).exists) {
      return { ok: false, error: `"${candidate.name}" is already in the list.` };
    }
  }

  const countSnap = await db.collection("serviceableAreas").count().get();

  await ref.set({
    name: candidate.name,
    displayName: candidate.name,
    slug,
    kind: "city",
    parentAreaId: null,
    ancestorIds: [],
    level: 0,
    province: candidate.province || "",
    region: candidate.region || "",
    country: candidate.country || "IT",
    lat: candidate.lat,
    lng: candidate.lng,
    boundingBox: candidate.boundingBox ?? null,
    osm: {
      id: candidate.osmId ?? null,
      type: candidate.osmType ?? null,
      class: candidate.osmClass ?? null,
      placeRank: candidate.placeRank ?? null,
    },
    active: true,
    sortOrder: countSnap.data().count,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: session.uid,
    updatedByUid: session.uid,
  });

  revalidatePath("/serviceable-areas");
  return { ok: true };
}

export async function setAreaActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const session = await requireAdminSession();
  if (!id) return { ok: false, error: "Missing area id." };
  await serverDb()
    .collection("serviceableAreas")
    .doc(id)
    .update({
      active: Boolean(active),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: session.uid,
    });
  revalidatePath("/serviceable-areas");
  return { ok: true };
}

export async function deleteServiceableArea(id: string): Promise<Result> {
  await requireAdminSession();
  if (!id) return { ok: false, error: "Missing area id." };
  await serverDb().collection("serviceableAreas").doc(id).delete();
  revalidatePath("/serviceable-areas");
  return { ok: true };
}
