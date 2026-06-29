"use client";

// Two-pane board: map (left) + scrollable area list (right), with an "Add area"
// button up top that opens the search modal. Selecting a pin highlights and
// scrolls to its list row, and vice versa.
//
// Receives the server-loaded areas as a prop; server actions call
// revalidatePath, which re-renders this with fresh data while preserving the
// local UI state (selection, modal open).

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/i18n/client";
import type { ServiceableArea } from "@/lib/serviceable-areas";
import { AreaRowActions } from "./area-row-actions";
import { AddAreaDialog } from "./add-area-dialog";

const AreasMap = dynamic(() => import("./areas-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  ),
});

export function AreasBoard({ areas }: { areas: ServiceableArea[] }) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const activeCount = areas.filter((a) => a.active).length;

  // Scroll the selected row into view inside the list pane.
  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`area-row-${selectedId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("serviceableAreas.listTitle", {
            active: activeCount,
            total: areas.length,
          })}
        </h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
        >
          {t("serviceableAreas.addBtn")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Map — `isolate` keeps Leaflet's z-indexes off the sticky header. */}
        <div className="relative isolate h-[70vh] overflow-hidden rounded-xl border border-border bg-surface lg:col-span-3">
          <AreasMap
            areas={areas}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* List */}
        <div className="h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface lg:col-span-2">
          {areas.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t("serviceableAreas.empty")}
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark"
              >
                {t("serviceableAreas.addBtn")}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {areas.map((a) => {
                const selected = a.id === selectedId;
                return (
                  <li
                    key={a.id}
                    id={`area-row-${a.id}`}
                    onClick={() => setSelectedId(a.id)}
                    className={`cursor-pointer px-4 py-3 transition-colors ${
                      selected ? "bg-primary/5" : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="truncate">{a.displayName}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[a.province, a.region].filter(Boolean).join(" · ") ||
                            "—"}
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {addOpen && <AddAreaDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}
