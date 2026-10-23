"use server";

// App configuration — server actions (admin-only). Thin: validation, the
// version numbering and the stale-edit check all live in the API.

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { apiAuthed, ApiCallError, AuthRequiredError } from "@/lib/session";
import type { AppConfig } from "./config-types";

type Result = { ok: true; version: number } | { ok: false; error: string; stale?: boolean };

function toError(err: unknown): Result {
  if (err instanceof ApiCallError) {
    return { ok: false, error: err.message, stale: err.status === 409 };
  }
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function saveConfig(input: {
  config: AppConfig;
  note: string;
  baseVersion: number;
}): Promise<Result> {
  await requireAdminSession();
  try {
    const res = await apiAuthed<{ version: number }>("/admin/config", {
      method: "POST",
      body: JSON.stringify({
        config: input.config,
        baseVersion: input.baseVersion,
        ...(input.note.trim() ? { note: input.note.trim() } : {}),
      }),
    });
    revalidatePath("/settings");
    return { ok: true, version: res?.version ?? input.baseVersion + 1 };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}

export async function restoreConfig(version: number, baseVersion: number): Promise<Result> {
  await requireAdminSession();
  try {
    const res = await apiAuthed<{ version: number }>(
      `/admin/config/versions/${encodeURIComponent(String(version))}/restore`,
      { method: "POST", body: JSON.stringify({ baseVersion }) },
    );
    revalidatePath("/settings");
    return { ok: true, version: res?.version ?? baseVersion + 1 };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}

export async function deleteConfigVersion(version: number): Promise<Result> {
  await requireAdminSession();
  try {
    await apiAuthed(`/admin/config/versions/${encodeURIComponent(String(version))}`, { method: "DELETE" });
    revalidatePath("/settings");
    return { ok: true, version };
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    return toError(err);
  }
}
