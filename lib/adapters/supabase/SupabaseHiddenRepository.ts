// lib/adapters/supabase/SupabaseHiddenRepository.ts
// Titles marked "Not interested", kept out of Home's recommendations.
import { fail, ok } from "@/lib/ports/result";
import type { HiddenRepository } from "@/lib/ports/hidden";
import { getSupabase } from "./client";

export const supabaseHiddenRepository: HiddenRepository = {
  async list() {
    const { data, error } = await getSupabase().from("hidden_titles").select("category, tmdb_id, title, poster_path").order("hidden_at", { ascending: false });
    if (error) return fail("Could not load the titles you hid.");
    return ok(data.map((row) => ({ category: row.category as "Movie" | "TV Show", tmdbId: row.tmdb_id as number, title: row.title as string, posterPath: row.poster_path as string | null })));
  },

  async hide(title) {
    const { error } = await getSupabase().from("hidden_titles").upsert(
      { category: title.category, tmdb_id: title.tmdbId, title: title.title, poster_path: title.posterPath, hidden_at: new Date().toISOString() },
      { onConflict: "user_id,category,tmdb_id" },
    );
    return error ? fail("Could not hide that title.") : ok(undefined);
  },

  async restore(category, tmdbId) {
    const { error } = await getSupabase().from("hidden_titles").delete().eq("category", category).eq("tmdb_id", tmdbId);
    return error ? fail("Could not undo that.") : ok(undefined);
  },
};
