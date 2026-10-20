"use client";

// Modal to edit a serviceable area: every stored detail on the left, a Google
// Maps search on the right. Picking a result relinks the SAME area to that
// place — name, province, region, coordinates, extent, Google id — while the
// id (the slug every property and tenant interest points at) never changes.
// This is how the areas found on OpenStreetMap before the switch get their
// Google details without losing a single linked listing.

import { useEffect, useState, useTransition } from "react";
import { searchPlaces, relinkServiceableArea } from "../actions";
import { useT } from "@/i18n/client";
import type { PlaceCandidate, ServiceableArea } from "@/lib/serviceable-areas";

type Row = { label: string; current: string; next?: string };

function fmtBox(b: ServiceableArea["boundingBox"]): string | null {
  if (!b) return null;
  return `${b.minLat.toFixed(4)}, ${b.minLng.toFixed(4)} → ${b.maxLat.toFixed(4)}, ${b.maxLng.toFixed(4)}`;
}

export function EditAreaDialog({
  area,
  onClose,
}: {
  area: ServiceableArea;
  onClose: () => void;
}) {
  const t = useT();
  const none = t("serviceableAreas.none");
  const [displayName, setDisplayName] = useState(area.displayName);
  const [query, setQuery] = useState(area.name);
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [chosen, setChosen] = useState<PlaceCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function runSearch() {
    if (query.trim().length < 2) return;
    setError(null);
    startSearch(async () => {
      const res = await searchPlaces(query);
      if (res.ok) setResults(res.data ?? []);
      else {
        setError(res.error);
        setResults(null);
      }
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const res = await relinkServiceableArea(area.id, { place: chosen, displayName });
      if (res.ok) {
        setSaved(true);
        onClose();
      } else setError(res.error);
    });
  }

  const dirty = chosen !== null || displayName.trim() !== area.displayName;
  const n = chosen;
  const rows: Row[] = [
    { label: t("serviceableAreas.fieldId"), current: area.id },
    { label: t("serviceableAreas.fieldName"), current: area.name, next: n?.name },
    { label: t("serviceableAreas.fieldProvince"), current: area.province || none, next: n ? n.province || none : undefined },
    { label: t("serviceableAreas.fieldRegion"), current: area.region || none, next: n ? n.region || none : undefined },
    { label: t("serviceableAreas.fieldCountry"), current: area.country || none, next: n ? n.country || "IT" : undefined },
    { label: t("serviceableAreas.fieldLat"), current: area.lat?.toFixed(6) ?? none, next: n ? n.lat.toFixed(6) : undefined },
    { label: t("serviceableAreas.fieldLng"), current: area.lng?.toFixed(6) ?? none, next: n ? n.lng.toFixed(6) : undefined },
    { label: t("serviceableAreas.fieldBoundingBox"), current: fmtBox(area.boundingBox) ?? none, next: n ? fmtBox(n.boundingBox) ?? none : undefined },
    { label: t("serviceableAreas.fieldOsmId"), current: area.osmId != null ? String(area.osmId) : none, next: n ? none : undefined },
    { label: t("serviceableAreas.fieldGooglePlaceId"), current: area.googlePlaceId ?? none, next: n ? n.googlePlaceId ?? none : undefined },
    {
      label: t("serviceableAreas.fieldCounts"),
      current: `${t("serviceableAreas.propertyCount", { count: area.propertyCount })} · ${t("serviceableAreas.interestedTenants", { count: area.interestedTenants })}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-16"
      role="dialog"
      aria-modal="true"
      aria-label={t("serviceableAreas.editTitle", { name: area.displayName })}
    >
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("serviceableAreas.editTitle", { name: area.displayName })}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("serviceableAreas.editIntro")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p
          className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            area.googlePlaceId ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {area.googlePlaceId ? t("serviceableAreas.sourceGoogle") : t("serviceableAreas.sourceOsm")}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Left: what is stored, and what the chosen place would make it. */}
          <section>
            <div className="grid grid-cols-[auto,1fr] gap-x-3 text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">{t("serviceableAreas.currentDetails")}</span>
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                {chosen ? t("serviceableAreas.newDetails") : ""}
              </span>
            </div>
            <dl className="mt-2 divide-y divide-border rounded-md border border-border text-xs">
              {rows.map((r) => (
                <div key={r.label} className="grid gap-1 px-3 py-2 md:grid-cols-[auto,1fr]">
                  <dt className="text-muted-foreground md:w-36">{r.label}</dt>
                  <dd className="min-w-0">
                    <span className={`break-all ${r.next !== undefined && r.next !== r.current ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {r.current}
                    </span>
                    {r.next !== undefined && r.next !== r.current && (
                      <span className="ml-2 break-all font-medium text-foreground">{r.next}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <label className="mt-3 block text-xs">
              <span className="text-muted-foreground">{t("serviceableAreas.displayNameLabel")}</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              />
            </label>
          </section>

          {/* Right: search Google for the same place and pick it. */}
          <section>
            <div className="flex gap-2">
              <input
                type="text"
                autoComplete="off"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                disabled={searching}
                placeholder={t("serviceableAreas.searchPlaceholder")}
                className="flex-1 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
              <button
                type="button"
                onClick={runSearch}
                disabled={searching || query.trim().length < 2}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? t("serviceableAreas.searching") : t("serviceableAreas.search")}
              </button>
            </div>

            {results && results.length === 0 && !searching && (
              <p className="mt-3 text-xs text-muted-foreground">{t("serviceableAreas.noResults")}</p>
            )}

            {results && results.length > 0 && (
              <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {results.map((c) => {
                  const isChosen = chosen?.googlePlaceId === c.googlePlaceId;
                  const sub = [c.province, c.region].filter(Boolean).join(" · ") || c.displayName;
                  return (
                    <li key={`${c.slug}-${c.googlePlaceId ?? ""}`} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${isChosen ? "bg-primary/5" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{sub}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChosen(isChosen ? null : c)}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          isChosen
                            ? "border border-border bg-surface text-foreground hover:bg-secondary"
                            : "bg-primary text-primary-foreground hover:bg-roome-blue-dark"
                        }`}
                      >
                        {isChosen ? t("serviceableAreas.clearChoice") : t("serviceableAreas.usePlace")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {error}
          </p>
        )}
        {saved && <p className="mt-3 text-xs text-success">{t("serviceableAreas.saved")}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty || !displayName.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("serviceableAreas.saving") : t("serviceableAreas.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
