// /serviceable-areas — admin-curated allowlist of cities where Roome operates.
//
// Tenants pick desired areas from the ACTIVE entries here (Flutter app, built
// by the app team — see docs/serviceable-areas-integration.md). When a
// landlord publishes in one of these areas, matched tenants get a push (Cloud
// Function, also in that doc). This page only manages the source-of-truth
// allowlist; the matching/notification logic lives elsewhere.

import "server-only";
import type { Timestamp } from "firebase-admin/firestore";
import { serverDb } from "@/lib/firebase-admin";
import { requireAdminSession } from "@/lib/auth";
import { getT } from "@/i18n/server";
import type { ServiceableArea, BoundingBox } from "@/lib/serviceable-areas";
import { AddArea } from "./_components/add-area";
import { AreaRowActions } from "./_components/area-row-actions";

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
  const nums = ["minLat", "maxLat", "minLng", "maxLng"].map((k) => b[k]);
  if (nums.some((n) => typeof n !== "number")) return null;
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
        typeof x.displayName === "string" ? x.displayName : String(x.name ?? d.id),
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

function BigPin() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10 opacity-50"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default async function ServiceableAreasPage() {
  await requireAdminSession();
  const [t, areas] = await Promise.all([getT(), loadAreas()]);
  const activeCount = areas.filter((a) => a.active).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("serviceableAreas.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("serviceableAreas.subtitle")}
          </p>
        </div>
        {areas.length > 0 && <AddArea />}
      </header>

      {areas.length === 0 && <AddArea defaultOpen />}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("serviceableAreas.listTitle", {
            active: activeCount,
            total: areas.length,
          })}
        </h2>

        {areas.length === 0 ? (
          <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <span className="text-muted-foreground" aria-hidden>
              <BigPin />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("serviceableAreas.empty")}
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {areas.map((a) => (
              <li key={a.id}>
                <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {a.displayName}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          a.active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.active
                          ? t("serviceableAreas.active")
                          : t("serviceableAreas.inactive")}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[a.province, a.region].filter(Boolean).join(" · ") || "—"}
                      {a.lat != null && a.lng != null && (
                        <span className="ml-2 font-mono text-[10px]">
                          {a.lat.toFixed(3)}, {a.lng.toFixed(3)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {a.id}
                    </p>
                  </div>
                  <AreaRowActions
                    id={a.id}
                    name={a.displayName}
                    active={a.active}
                  />
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
