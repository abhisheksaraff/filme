// lib/adapters/supabase/SupabaseDataRepository.ts
// Raw table export and import for backups. Row-level security keeps this to the user's own rows.
import type { DataRepository, ExportBundle } from "@/lib/ports/data";
import { fail, ok } from "@/lib/ports/result";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./client";

/** Tables in the order they can be restored (parents before children). */
export const EXPORT_TABLES = [
  "media_items", "genres", "people", "media_genres", "media_people", "venues", "watch_sessions",
  "images", "want_to_watch", "user_settings",
] as const;

const PAGE = 1000;
const BATCH = 200;
/** Columns the database fills in itself and refuses to take back. */
const GENERATED = new Set(["search"]);

/**
 * Syncing must never put an older copy over a newer one: rows whose id already exists with a newer
 * updated_at are left alone. Tables without ids or timestamps are simply merged by their key.
 */
async function withoutOlderRows(db: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const stamped = rows.filter((row) => typeof row.id === "string" && typeof row.updated_at === "string");
  if (stamped.length === 0) return rows;
  const existing = await db.from(table).select("id, updated_at").in("id", stamped.map((row) => row.id as string));
  if (existing.error) return rows;
  const current = new Map((existing.data as { id: string; updated_at: string }[]).map((row) => [row.id, row.updated_at]));
  return rows.filter((row) => {
    const have = typeof row.id === "string" ? current.get(row.id) : undefined;
    return !have || typeof row.updated_at !== "string" || Date.parse(row.updated_at) >= Date.parse(have);
  });
}

export const supabaseDataRepository: DataRepository = {
  async exportTables() {
    const db = getSupabase();
    const tables: ExportBundle["tables"] = {};
    for (const table of EXPORT_TABLES) {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
        if (error) return fail(`Could not read ${table}.`);
        rows.push(...(data as Record<string, unknown>[]));
        if (data.length < PAGE) break;
      }
      tables[table] = rows;
    }
    return ok({ version: 1, exportedAt: new Date().toISOString(), tables });
  },

  async importTables(bundle) {
    const db = getSupabase();
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return fail("Your session has expired. Sign in again.");
    let count = 0;
    for (const table of EXPORT_TABLES) {
      // SECURITY: a backup file is untrusted input, so every row is assigned to the signed-in user
      // whatever it says, and row-level security still decides what is accepted.
      const rows = (bundle.tables[table] ?? []).map((row) => {
        const clean = Object.fromEntries(Object.entries(row).filter(([key]) => !GENERATED.has(key)));
        return "user_id" in clean ? { ...clean, user_id: userId } : clean;
      });
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = await withoutOlderRows(db, table, rows.slice(i, i + BATCH));
        // Matching on the primary key makes restoring twice harmless.
        const { error } = await db.from(table).upsert(chunk, { ignoreDuplicates: false });
        if (error) return fail(`Could not restore ${table}.`);
        count += chunk.length;
      }
    }
    return ok(count);
  },

  async imageRows(filter) {
    let query = getSupabase().from("images").select("id, kind, path, store").eq("source", "upload").order("created_at");
    if (filter?.store) query = query.eq("store", filter.store);
    if (filter?.limit) query = query.limit(filter.limit);
    const { data, error } = await query;
    return error ? fail("Could not list your images.") : ok(data as { id: string; kind: string; path: string; store: string }[]);
  },

  async setImageStore(id, store) {
    const { error } = await getSupabase().from("images").update({ store }).eq("id", id);
    return error ? fail("Could not record where an image is stored.") : ok(undefined);
  },

  async readCover(path) {
    const { data, error } = await getSupabase().storage.from("covers").download(path);
    return error || !data ? fail("Could not download a picture.") : ok(data);
  },

  async writeCover(path, blob) {
    const { error } = await getSupabase().storage.from("covers").upload(path, blob, { contentType: blob.type, upsert: true });
    return error ? fail("Could not restore a picture.") : ok(undefined);
  },
};
