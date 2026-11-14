// lib/adapters/supabase/SupabaseDataRepository.ts
// Raw table export and import for backups. Row-level security keeps this to the user's own rows.
import type { DataRepository, ExportBundle } from "@/lib/ports/data";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

/** Tables in the order they can be restored (parents before children). */
export const EXPORT_TABLES = [
  "media_items", "genres", "people", "media_genres", "media_people", "venues", "watch_sessions",
  "images", "want_to_watch", "collections", "collection_items", "user_settings",
] as const;

const PAGE = 1000;
const BATCH = 200;
/** Columns the database fills in itself and refuses to take back. */
const GENERATED = new Set(["search"]);

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
        const chunk = rows.slice(i, i + BATCH);
        // Matching on the primary key makes restoring twice harmless.
        const { error } = await db.from(table).upsert(chunk, { ignoreDuplicates: false });
        if (error) return fail(`Could not restore ${table}.`);
        count += chunk.length;
      }
    }
    return ok(count);
  },

  async downloadFile(bucket, path) {
    const { data, error } = await getSupabase().storage.from(bucket).download(path);
    return error || !data ? fail("Could not download a file.") : ok(data);
  },

  async uploadFile(bucket, path, blob) {
    const { error } = await getSupabase().storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: true });
    return error ? fail("Could not restore a file.") : ok(undefined);
  },
};
