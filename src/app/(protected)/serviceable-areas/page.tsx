// /serviceable-areas — admin-curated allowlist of cities where Roome operates.
//
// Tenants pick desired areas from the ACTIVE entries here (Flutter app, built
// by the app team — see docs/serviceable-areas-integration.md). When a
// landlord publishes in one of these areas, matched tenants get a push (Cloud
// Function, also in that doc). This page only manages the source-of-truth
// allowlist; the matching/notification logic lives elsewhere.
//
// Server component: loads the list, hands it to the client <AreasBoard>
// (map + list + add modal).

import "server-only";
import type { Timestamp } from "firebase-admin/firestore";
import { serverDb } from "@/lib/firebase-admin";
import { requireAdminSession } from "@/lib/auth";
import { getT } from "@/i18n/server";
import type { ServiceableArea, BoundingBox } from "@/lib/serviceable-areas";
import { AreasBoard } from "./_components/areas-board";

function tsToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as Timestamp).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

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

async function loadAreas(): Promise<ServiceableArea[]> {
  const snap = await serverDb()
    .collection("serviceableAreas")
    .orderBy("sortOrder", "asc")
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: typeof x.name === "string" ? x.name : d.id,
      displayName:
        typeof x.displayName === "string"
          ? x.displayName
          : String(x.name ?? d.id),
      slug: typeof x.slug === "string" ? x.slug : d.id,
      kind: x.kind === "zone" ? "zone" : "city",
      parentAreaId: typeof x.parentAreaId === "string" ? x.parentAreaId : null,
      ancestorIds: Array.isArray(x.ancestorIds)
        ? x.ancestorIds.filter((s): s is string => typeof s === "string")
        : [],
      level: typeof x.level === "number" ? x.level : 0,
      province: typeof x.province === "string" ? x.province : "",
      region: typeof x.region === "string" ? x.region : "",
      country: typeof x.country === "string" ? x.country : "IT",
      lat: typeof x.lat === "number" ? x.lat : null,
      lng: typeof x.lng === "number" ? x.lng : null,
      boundingBox: asBoundingBox(x.boundingBox),
      active: x.active !== false,
      sortOrder: typeof x.sortOrder === "number" ? x.sortOrder : 0,
      createdAt: tsToMillis(x.createdAt),
    };
  });
}

export default async function ServiceableAreasPage() {
  await requireAdminSession();
  const [t, areas] = await Promise.all([getT(), loadAreas()]);

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

      <AreasBoard areas={areas} />
    </div>
  );
}
