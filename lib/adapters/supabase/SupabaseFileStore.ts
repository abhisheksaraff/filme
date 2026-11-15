// lib/adapters/supabase/SupabaseFileStore.ts
// Image files in Supabase Storage's private "media" bucket: where everything lived before the move
// to an S3-compatible store, and a fallback if that store is ever unavailable.
import type { FileStore } from "@/lib/ports/files";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const BUCKET = "media";

export const supabaseFileStore: FileStore = {
  id: "supabase",

  async put(path, blob) {
    const { error } = await getSupabase().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
    return error ? fail("Could not upload the image.") : ok(undefined);
  },

  async get(path) {
    const { data, error } = await getSupabase().storage.from(BUCKET).download(path);
    return error || !data ? fail("Could not download the image.") : ok(data);
  },

  async urls(paths) {
    if (paths.length === 0) return ok(new Map());
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error) return fail("Could not load the images.");
    return ok(new Map((data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []))));
  },

  async remove(paths) {
    if (paths.length === 0) return ok(undefined);
    const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
    return error ? fail("Could not delete the images.") : ok(undefined);
  },

  async usage() {
    const { data, error } = await getSupabase().rpc("my_storage_bytes");
    return error ? fail("Could not check storage.") : ok(Number(data ?? 0));
  },
};
