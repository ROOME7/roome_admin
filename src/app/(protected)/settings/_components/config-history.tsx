"use client";

// Every saved version, newest first. "Changes" opens a side-by-side of what
// that version changed; "Restore" copies it forward as a new live version.

import { Fragment, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { restoreConfig } from "../actions";
import type { ConfigVersion } from "../config-types";

function valueAt(obj: unknown, path: string): string {
  const v = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  return v === null || v === undefined ? "—" : String(v);
}

export function ConfigHistory({ versions, liveVersion }: { versions: ConfigVersion[]; liveVersion: number }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startRestore] = useTransition();

  function restore(version: number) {
    setError(null);
    startRestore(async () => {
      const res = await restoreConfig(version, liveVersion);
      if (!res.ok) setError(res.stale ? t("settings.staleError") : res.error);
      setConfirming(null);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">{t("settings.history")}</h2>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      <ul className="space-y-2">
        {versions.map((v, i) => {
          const prev = versions[i + 1];
          const isOpen = open === v.version;
          return (
            <li key={v.version} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">v{v.version}</span>
                    {v.live && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">{t("settings.live")}</span>}
                    {v.forcedUpdate && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">{t("settings.forcedUpdate")}</span>}
                    {v.restoredFrom && <span className="text-xs text-muted-foreground">{t("settings.restoredFrom", { version: v.restoredFrom })}</span>}
                    <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
                    {v.createdBy?.name && <span className="text-xs text-muted-foreground">{v.createdBy.name}</span>}
                  </p>
                  {v.changed.length > 0 && (
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {v.changed.slice(0, 3).join(", ")}
                      {v.changed.length > 3 ? ` ${t("settings.andMore", { count: v.changed.length - 3 })}` : ""}
                    </p>
                  )}
                  {v.note && <p className="text-sm italic text-foreground">“{v.note}”</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {v.changed.length > 0 && (
                    <button type="button" onClick={() => setOpen(isOpen ? null : v.version)} className="rounded-md px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary" aria-expanded={isOpen}>
                      {t("settings.changes")}
                    </button>
                  )}
                  {!v.live &&
                    (confirming === v.version ? (
                      <>
                        <button type="button" onClick={() => restore(v.version)} disabled={pending} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">
                          {pending ? t("settings.restoring") : t("settings.confirmRestore", { version: v.version })}
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} disabled={pending} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary">
                          {t("common.cancel")}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirming(v.version)} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary">
                        {t("settings.restore")}
                      </button>
                    ))}
                </div>
              </div>
              {isOpen && prev && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">{t("settings.key")}</th>
                        <th className="py-1 pr-3 font-medium">v{prev.version}</th>
                        <th className="py-1 font-medium">v{v.version}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.changed.map((k) => (
                        <Fragment key={k}>
                          <tr className="border-t border-border">
                            <td className="py-1.5 pr-3 font-mono text-muted-foreground">{k}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-muted-foreground line-through">{valueAt(prev.config, k)}</td>
                            <td className="py-1.5 tabular-nums text-foreground">{valueAt(v.config, k)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
