"use client";

// The editable configuration. Edits start from the live version; Save sends
// the whole object with `baseVersion`, and the API refuses it (409) if
// someone else saved in between rather than overwriting their change.

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { saveConfig } from "../actions";
import type { AppConfig, ConfigVersion, PlatformGate } from "../config-types";

function changedKeys(a: unknown, b: unknown, prefix = ""): string[] {
  const isObj = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])].sort();
    return keys.flatMap((k) => changedKeys((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null) ? [] : [prefix];
}

const inputClass =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PlatformFields({
  name,
  title,
  gate,
  onChange,
}: {
  name: "ios" | "android";
  title: string;
  gate: PlatformGate;
  onChange: (g: PlatformGate) => void;
}) {
  const t = useT();
  const set = <K extends keyof PlatformGate>(k: K, v: PlatformGate[K]) => onChange({ ...gate, [k]: v });
  const num = (s: string) => (s.trim() === "" ? 0 : Math.max(0, Math.floor(Number(s) || 0)));
  const minAboveLatest = gate.minBuild > gate.latestBuild;
  return (
    <fieldset className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${name}-latestVersion`} label={t("settings.latestVersion")}>
          <input id={`${name}-latestVersion`} className={inputClass} value={gate.latestVersion} onChange={(e) => set("latestVersion", e.target.value)} placeholder="2.4.1" />
        </Field>
        <Field id={`${name}-latestBuild`} label={t("settings.latestBuild")} hint={t("settings.latestBuildHint")}>
          <input id={`${name}-latestBuild`} className={`${inputClass} tabular-nums`} inputMode="numeric" value={String(gate.latestBuild)} onChange={(e) => set("latestBuild", num(e.target.value))} />
        </Field>
        <Field id={`${name}-minVersion`} label={t("settings.minVersion")}>
          <input id={`${name}-minVersion`} className={inputClass} value={gate.minVersion} onChange={(e) => set("minVersion", e.target.value)} placeholder="2.3.0" />
        </Field>
        <Field id={`${name}-minBuild`} label={t("settings.minBuild")} hint={minAboveLatest ? t("settings.minAboveLatest") : t("settings.minBuildHint")}>
          <input id={`${name}-minBuild`} className={`${inputClass} tabular-nums ${minAboveLatest ? "border-destructive" : ""}`} inputMode="numeric" value={String(gate.minBuild)} onChange={(e) => set("minBuild", num(e.target.value))} aria-invalid={minAboveLatest} />
        </Field>
      </div>
      <Field id={`${name}-updateMessage`} label={t("settings.updateMessage")} hint={t("settings.updateMessageHint")}>
        <input id={`${name}-updateMessage`} className={inputClass} value={gate.updateMessage ?? ""} onChange={(e) => set("updateMessage", e.target.value.trim() ? e.target.value : null)} />
      </Field>
      <Field id={`${name}-storeUrl`} label={t("settings.storeUrl")}>
        <input id={`${name}-storeUrl`} className={inputClass} type="url" value={gate.storeUrl ?? ""} onChange={(e) => set("storeUrl", e.target.value.trim() ? e.target.value.trim() : null)} placeholder={name === "ios" ? "https://apps.apple.com/…" : "https://play.google.com/store/apps/details?id=…"} />
      </Field>
    </fieldset>
  );
}

export function ConfigForm({ live }: { live: ConfigVersion }) {
  const t = useT();
  const [config, setConfig] = useState<AppConfig>(live.config);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const changes = useMemo(() => changedKeys(live.config, config), [live.config, config]);
  const invalid = config.ios.minBuild > config.ios.latestBuild || config.android.minBuild > config.android.latestBuild;
  const raisesMinimum = config.ios.minBuild > live.config.ios.minBuild || config.android.minBuild > live.config.android.minBuild;

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveConfig({ config, note, baseVersion: live.version });
      if (!res.ok) setError(res.stale ? t("settings.staleError") : res.error);
    });
  }

  return (
    <div className="space-y-6">
      <p className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
          {t("settings.liveVersion", { version: live.version })}
        </span>
        <span>
          {live.createdBy?.name ? t("settings.liveBy", { name: live.createdBy.name }) : ""}{" "}
          {new Date(live.createdAt).toLocaleString()}
        </span>
      </p>

      <section className="space-y-5 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("settings.releaseGates")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("settings.releaseGatesHelp")}</p>
        </div>
        <PlatformFields name="ios" title="iOS" gate={config.ios} onChange={(ios) => setConfig({ ...config, ios })} />
        <PlatformFields name="android" title="Android" gate={config.android} onChange={(android) => setConfig({ ...config, android })} />
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">{t("settings.maintenance")}</h2>
        <label className="flex items-center gap-2 text-sm text-foreground" htmlFor="maintenance-enabled">
          <input
            id="maintenance-enabled"
            type="checkbox"
            className="h-4 w-4"
            checked={config.maintenance.enabled}
            onChange={(e) => setConfig({ ...config, maintenance: { ...config.maintenance, enabled: e.target.checked } })}
          />
          {t("settings.maintenanceEnabled")}
        </label>
        <Field id="maintenance-message" label={t("settings.maintenanceMessage")}>
          <input
            id="maintenance-message"
            className={inputClass}
            value={config.maintenance.message ?? ""}
            onChange={(e) => setConfig({ ...config, maintenance: { ...config.maintenance, message: e.target.value.trim() ? e.target.value : null } })}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">{t("settings.save")}</h2>
        <Field id="config-note" label={t("settings.noteLabel")} hint={t("settings.noteHint")}>
          <input id="config-note" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t("settings.notePlaceholder")} />
        </Field>
        {raisesMinimum && changes.length > 0 && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{t("settings.forcedWarning")}</p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || changes.length === 0 || invalid}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("settings.saving") : t("settings.saveNewVersion")}
          </button>
          <span className="text-xs text-muted-foreground">
            {changes.length === 0
              ? t("settings.noChanges")
              : t("settings.changesCount", { count: changes.length, keys: changes.slice(0, 3).join(", ") + (changes.length > 3 ? "…" : "") })}
          </span>
        </div>
      </section>
    </div>
  );
}
