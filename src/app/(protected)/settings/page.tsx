// /settings — admin settings. Two tabs: the admin's own account (placeholder)
// and Configuration, the versioned config every app reads at launch.

import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdminSession } from "@/lib/auth";
import { apiAuthed } from "@/lib/session";
import type { ConfigVersion } from "./config-types";
import { ConfigForm } from "./_components/config-form";
import { ConfigHistory } from "./_components/config-history";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const [, t, params] = await Promise.all([requireAdminSession(), getT(), searchParams]);
  const tab = params.tab === "account" ? "account" : "configuration";

  let versions: ConfigVersion[] = [];
  let loadError = false;
  if (tab === "configuration") {
    try {
      const res = await apiAuthed<{ items: ConfigVersion[] }>("/admin/config/versions", { query: { limit: 50 } });
      versions = res?.items ?? [];
    } catch {
      loadError = true;
    }
  }
  const live = versions.find((v) => v.live) ?? null;

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-surface text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <nav className="inline-flex gap-1 rounded-lg bg-secondary p-1" aria-label={t("settings.title")}>
        <Link href="/settings?tab=configuration" className={tabClass(tab === "configuration")} aria-current={tab === "configuration" ? "page" : undefined}>
          {t("settings.tabConfiguration")}
        </Link>
        <Link href="/settings?tab=account" className={tabClass(tab === "account")} aria-current={tab === "account" ? "page" : undefined}>
          {t("settings.tabAccount")}
        </Link>
      </nav>

      {tab === "account" ? (
        <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("settings.comingSoon")}</p>
        </section>
      ) : loadError || !live ? (
        <section role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {t("settings.loadError")}
        </section>
      ) : (
        <div className="max-w-4xl space-y-6">
          {/* key = live version: a save or restore remounts the form on the new baseline. */}
          <ConfigForm key={live.version} live={live} />
          <ConfigHistory versions={versions} liveVersion={live.version} />
        </div>
      )}
    </div>
  );
}
