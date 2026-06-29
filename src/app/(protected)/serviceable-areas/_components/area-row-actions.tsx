"use client";

// Per-row controls: activate/deactivate (tenants only see active areas) and
// remove. Remove asks for an inline confirm first.

import { useState, useTransition } from "react";
import { setAreaActive, deleteServiceableArea } from "../actions";
import { useT } from "@/i18n/client";

export function AreaRowActions({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setAreaActive(id, !active);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteServiceableArea(id);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {active
            ? t("serviceableAreas.deactivate")
            : t("serviceableAreas.activate")}
        </button>

        {confirming ? (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? t("serviceableAreas.removing")
                : t("serviceableAreas.confirmRemove")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            title={t("serviceableAreas.removeTitle", { name })}
            className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("serviceableAreas.remove")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[10px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
