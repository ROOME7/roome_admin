"use server";

// Address lookups for the create-listing form, through the API's Google proxy
// (`/places/autocomplete`, `/places/{id}`). The Google key stays on the API;
// this file carries the admin's token and reshapes the answer for the form.

import { requireAdminSession } from "@/lib/auth";
import { apiAuthed, ApiCallError, AuthRequiredError } from "@/lib/session";

export interface AddressSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export interface ResolvedAddress {
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  province: string;
  region: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(err: unknown): Result<never> {
  if (err instanceof ApiCallError) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function suggestAddresses(
  input: string,
  sessionToken: string,
): Promise<Result<AddressSuggestion[]>> {
  await requireAdminSession();
  if (input.trim().length < 3) return { ok: true, data: [] };
  try {
    const res = await apiAuthed<{ items: AddressSuggestion[] }>("/places/autocomplete", {
      query: { input: input.trim(), sessionToken, mode: "address" },
    });
    return { ok: true, data: res?.items ?? [] };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}

export async function resolveAddress(
  placeId: string,
  sessionToken: string,
): Promise<Result<ResolvedAddress>> {
  await requireAdminSession();
  try {
    const res = await apiAuthed<{
      place: {
        placeId: string;
        lat: number;
        lng: number;
        address: {
          street: string | null;
          civic: string | null;
          city: string | null;
          postalCode: string | null;
          neighborhood: string | null;
          province: string | null;
          region: string | null;
        };
      };
    }>(`/places/${encodeURIComponent(placeId)}`, { query: { sessionToken } });
    if (!res?.place) return { ok: false, error: "Place not found." };
    const p = res.place;
    return {
      ok: true,
      data: {
        street: p.address.street ?? "",
        streetNumber: p.address.civic ?? "",
        postalCode: p.address.postalCode ?? "",
        city: p.address.city ?? "",
        province: p.address.province ?? "",
        region: p.address.region ?? "",
        neighborhood: p.address.neighborhood ?? "",
        latitude: Number.isFinite(p.lat) ? p.lat : null,
        longitude: Number.isFinite(p.lng) ? p.lng : null,
        placeId: p.placeId,
      },
    };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}
