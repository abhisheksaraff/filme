// lib/adapters/files/EdgeFileStore.ts
// Image files in an S3-compatible bucket, reached through the `files` Edge Function.
import { getSupabase } from "@/lib/adapters/supabase/client";
import { callFunction } from "@/lib/adapters/supabase/functions";
import type { FileStore } from "@/lib/ports/files";
import { fail, ok } from "@/lib/ports/result";

const ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/files`;
/** View links last an hour; they are reused for 50 minutes so lists do not ask again on every visit. */
const REUSE_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string; until: number }>();

async function headers(): Promise<Record<string, string> | null> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } : null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const detail = await res.json().catch(() => null);
  return detail && typeof detail.error === "string" ? detail.error : fallback;
}

export const edgeFileStore: FileStore = {
  id: "files",

  async put(path, blob) {
    const auth = await headers();
    if (!auth) return fail("Your session has expired. Sign in again.");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { ...auth, "x-action": "put", "x-path": path, "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
      return res.ok ? ok(undefined) : fail(await readError(res, "Could not upload the image."));
    } catch {
      return fail("Could not reach the server. Check your connection.");
    }
  },

  async get(path) {
    const auth = await headers();
    if (!auth) return fail("Your session has expired. Sign in again.");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ action: "get", path }),
      });
      return res.ok ? ok(await res.blob()) : fail(await readError(res, "Could not download the image."));
    } catch {
      return fail("Could not reach the server. Check your connection.");
    }
  },

  async urls(paths) {
    const now = Date.now();
    const out = new Map<string, string>();
    const missing: string[] = [];
    for (const path of paths) {
      const hit = cache.get(path);
      if (hit && hit.until > now) out.set(path, hit.url);
      else missing.push(path);
    }
    for (let i = 0; i < missing.length; i += 100) {
      const res = await callFunction<{ urls: Record<string, string> }>("files", { action: "sign", paths: missing.slice(i, i + 100) });
      if (!res.ok) return fail(res.error);
      for (const [path, url] of Object.entries(res.value.urls)) {
        cache.set(path, { url, until: now + REUSE_MS });
        out.set(path, url);
      }
    }
    return ok(out);
  },

  async remove(paths) {
    for (let i = 0; i < paths.length; i += 100) {
      const res = await callFunction("files", { action: "delete", paths: paths.slice(i, i + 100) });
      if (!res.ok) return fail(res.error);
    }
    for (const path of paths) cache.delete(path);
    return ok(undefined);
  },

  async usage() {
    const res = await callFunction<{ bytes: number }>("files", { action: "usage" });
    return res.ok ? ok(res.value.bytes) : fail(res.error);
  },
};
