"use client";

// "Add an area" — search OSM for an Italian city, then add a chosen result as
// a serviceable area. Search runs on submit (not per-keystroke) to respect
// Nominatim's 1 req/sec usage policy.

import { useState, useTransition } from "react";
import { searchPlaces, createServiceableArea } from "../actions";
import { useT } from "@/i18n/client";
import type { PlaceCandidate } from "@/lib/serviceable-areas";

export function AddArea() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [addingSlug, setAddingSlug] = useState<string | null>(null);

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
        // Drop the added one from the candidate list; revalidatePath refreshes
        // the page's area list on the server.
        setResults((prev) => prev?.filter((x) => x.slug !== c.slug) ?? null);
      } else {
        setError(res.error);
      }
      setAddingSlug(null);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
      >
        {t("serviceableAreas.addBtn")}
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("serviceableAreas.addTitle")}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          autoComplete="off"
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
          className="flex-1 rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching || query.trim().length < 2}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? t("serviceableAreas.searching") : t("serviceableAreas.search")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
            setResults(null);
            setError(null);
          }}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t("common.cancel")}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      {results && results.length === 0 && !searching && (
        <p className="px-1 py-1 text-xs text-muted-foreground">
          {t("serviceableAreas.noResults")}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {results.map((c) => (
            <li
              key={c.slug}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => add(c)}
                disabled={adding}
                className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding && addingSlug === c.slug
                  ? t("serviceableAreas.adding")
                  : t("serviceableAreas.add")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
