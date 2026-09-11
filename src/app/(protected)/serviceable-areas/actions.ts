"use server";

// Serviceable Areas — server actions (admin-only).
//
//   searchPlaces           OSM lookup for Italian settlements
//   createServiceableArea  store a chosen place as a serviceable area
//   setAreaActive          switch an area on or off
//   deleteServiceableArea  remove one permanently
//
// ⚠️ ALL FOUR ARE NOW THIN. The OSM query, the settlement filter, the dedupe,
// the slug collision rule for two same-named comuni, the refusal to delete a
// city that still has properties — every one of those decisions used to live
// in this file AND in the API, in two copies that could disagree. They live in
// the API. This file carries the admin's token and reports what came back.

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { apiAuthed, ApiCallError, AuthRequiredError } from "@/lib/session";
import type { PlaceCandidate } from "@/lib/serviceable-areas";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * The API answers in the admin's language and its messages are written for a
 * person, so they are shown as-is. Only the codes that need a specific action
 * get a hand-written line.
 */
function toError(err: unknown): Result<never> {
  if (err instanceof ApiCallError) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function searchPlaces(
  query: string,
): Promise<Result<PlaceCandidate[]>> {
  await requireAdminSession();
  const q = query.trim();
  // Under two characters the lookup matches most of Italy; the API refuses it
  // too, and asking is just a round trip to be told so.
  if (q.length < 2) return { ok: true, data: [] };

  try {
    const res = await apiAuthed<{ items: PlaceCandidate[] }>(
      `/admin/areas/search?q=${encodeURIComponent(q)}`,
    );
    return { ok: true, data: res?.items ?? [] };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}

export async function createServiceableArea(
  candidate: PlaceCandidate,
): Promise<Result> {
  await requireAdminSession();
  if (!candidate?.name || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    return { ok: false, error: "Invalid place data." };
  }

  try {
    // Passed through verbatim: `osmId` is what distinguishes two same-named
    // comuni, and dropping it here is how both end up fighting over one id.
    await apiAuthed("/admin/areas", {
      method: "POST",
      body: JSON.stringify({
        name: candidate.name,
        province: candidate.province || undefined,
        region: candidate.region || undefined,
        country: (candidate.country || "IT").toUpperCase(),
        lat: candidate.lat,
        lng: candidate.lng,
        boundingBox: candidate.boundingBox,
        osmId: candidate.osmId,
        osmType: candidate.osmType,
        osmClass: candidate.osmClass,
        placeRank: candidate.placeRank,
      }),
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }

  revalidatePath("/serviceable-areas");
  return { ok: true };
}

export async function setAreaActive(id: string, active: boolean): Promise<Result> {
  await requireAdminSession();
  if (!id) return { ok: false, error: "Missing area id." };

  try {
    await apiAuthed(`/admin/areas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active: Boolean(active) }),
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }

  revalidatePath("/serviceable-areas");
  return { ok: true };
}

export async function deleteServiceableArea(id: string): Promise<Result> {
  await requireAdminSession();
  if (!id) return { ok: false, error: "Missing area id." };

  try {
    // A 409 here means live properties still point at the area. The API's
    // message says to deactivate instead, which is the whole answer.
    await apiAuthed(`/admin/areas/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }

  revalidatePath("/serviceable-areas");
  return { ok: true };
}
