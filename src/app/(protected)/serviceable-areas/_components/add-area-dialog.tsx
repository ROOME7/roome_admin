"use client";

// Modal to add a serviceable area: search OSM for an Italian city, then add a
// result. Search runs on submit (Nominatim ~1 req/sec policy). Stays open after
// an add so several areas can be added in a row; revalidatePath refreshes the
// map + list underneath.

import { useEffect, useState, useTransition } from "react";
import { searchPlaces, createServiceableArea } from "../actions";
import { useT } from "@/i18n/client";
import type { PlaceCandidate } from "@/lib/serviceable-areas";

export function AddAreaDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [addingSlug, setAddingSlug] = useState<string | null>(null);

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

  function add(c: PlaceCandidate) {
    setError(null);
    setAddingSlug(c.slug);
    startAdd(async () => {
      const res = await createServiceableArea(c);
      if (res.ok) {
        setResults((prev) => prev?.filter((x) => x.slug !== c.slug) ?? null);
      } else {
        setError(res.error);
      }
      setAddingSlug(null);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24"
      role="dialog"
      aria-modal="true"
      aria-label={t("serviceableAreas.addTitle")}
    >
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("serviceableAreas.addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex gap-2">
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
            {searching
              ? t("serviceableAreas.searching")
              : t("serviceableAreas.search")}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        {results && results.length === 0 && !searching && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("serviceableAreas.noResults")}
          </p>
        )}

        {results && results.length > 0 && (
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {results.map((c) => {
              const region =
                [c.province, c.region].filter(Boolean).join(" · ") ||
                c.displayName;
              return (
                <li
                  key={`${c.slug}-${c.osmId ?? ""}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {region}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(c)}
                    disabled={adding}
                    className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {adding && addingSlug === c.slug
                      ? t("serviceableAreas.adding")
                      : t("serviceableAreas.add")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
