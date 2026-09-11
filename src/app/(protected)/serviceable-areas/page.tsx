// /serviceable-areas — the admin-curated allowlist of cities Roome operates in.
//
// Tenants pick their desired areas from the ACTIVE entries here; when a
// landlord publishes in one, matched tenants get a push. This page manages the
// allowlist itself — the matching lives in the API.
//
// Server Component: loads the board and hands it to the client <AreasBoard>
// (map + list + add modal).

import "server-only";
import { apiAuthed } from "@/lib/session";
import { requireAdminSession } from "@/lib/auth";
import { getT } from "@/i18n/server";
import type {
  BoundingBox,
  ServiceableArea,
  UnservedDemand,
} from "@/lib/serviceable-areas";
import { AreasBoard } from "./_components/areas-board";

/** One row of `GET /admin/areas`, before the client-safe mapping below. */
interface ApiArea {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  kind: string;
  level: number;
  parentAreaId: string | null;
  province: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  boundingBox: unknown;
  active: boolean;
  sortOrder: number;
  createdAt: string | null;
  propertyCount: number;
  interestedTenants: number;
}

/**
 * `boundingBox` is a JSON column, so it arrives as whatever was stored. The
 * map draws a rectangle from it and four numbers is the only version of that
 * which means anything — a partial box would render somewhere in the sea.
 */
function asBoundingBox(v: unknown): BoundingBox | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const keys = ["minLat", "maxLat", "minLng", "maxLng"] as const;
  if (keys.some((k) => typeof b[k] !== "number")) return null;
  return {
    minLat: b.minLat as number,
    maxLat: b.maxLat as number,
    minLng: b.minLng as number,
    maxLng: b.maxLng as number,
  };
}

async function loadBoard(): Promise<{
  areas: ServiceableArea[];
  unservedDemand: UnservedDemand[];
}> {
  const res = await apiAuthed<{
    items: ApiArea[];
    unservedDemand: UnservedDemand[];
  }>("/admin/areas");

  if (!res) return { areas: [], unservedDemand: [] };

  return {
    areas: res.items.map((a) => ({
      id: a.id,
      name: a.name,
      displayName: a.displayName,
      slug: a.slug,
      kind: a.kind === "zone" ? "zone" : "city",
      parentAreaId: a.parentAreaId,
      level: a.level,
      province: a.province ?? "",
      region: a.region ?? "",
      country: a.country ?? "IT",
      lat: a.lat,
      lng: a.lng,
      boundingBox: asBoundingBox(a.boundingBox),
      active: a.active,
      sortOrder: a.sortOrder,
      // Epoch ms: a Date cannot cross into a Client Component.
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : null,
      propertyCount: a.propertyCount,
      interestedTenants: a.interestedTenants,
    })),
    unservedDemand: res.unservedDemand ?? [],
  };
}

export default async function ServiceableAreasPage() {
  await requireAdminSession();
  const [t, { areas, unservedDemand }] = await Promise.all([getT(), loadBoard()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("serviceableAreas.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {t("serviceableAreas.subtitle")}
        </p>
      </header>

      <AreasBoard areas={areas} unservedDemand={unservedDemand} />
    </div>
  );
}
