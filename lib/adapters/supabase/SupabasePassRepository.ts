// lib/adapters/supabase/SupabasePassRepository.ts
// Rewatch resets and the edits made to completion cards.
import type { PassRepository, StackEdit } from "@/lib/ports/passes";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

export const supabasePassRepository: PassRepository = {
  async resets(mediaId) {
    const { data, error } = await getSupabase().from("tv_resets").select("season, reset_at").eq("media_id", mediaId);
    if (error) return fail("Could not load your rewatch progress.");
    return ok((data ?? []).map((r) => ({ season: (r.season as number | null) ?? null, at: r.reset_at as string })));
  },

  async reset(mediaId, season) {
    const { error } = await getSupabase().from("tv_resets").insert({ media_id: mediaId, season });
    return error ? fail("Could not reset that.") : ok(undefined);
  },

  async edits(mediaId) {
    const { data, error } = await getSupabase().from("tv_stack_edits").select("season, pass_key, fields").eq("media_id", mediaId);
    if (error) return fail("Could not load your edits.");
    return ok((data ?? []).map((r): StackEdit => ({ season: (r.season as number) < 0 ? null : (r.season as number), passKey: r.pass_key as string, fields: (r.fields ?? {}) as StackEdit["fields"] })));
  },

  async saveEdit(mediaId, season, passKey, fields) {
    const { error } = await getSupabase()
      .from("tv_stack_edits")
      .upsert({ media_id: mediaId, season: season ?? -1, pass_key: passKey, fields, updated_at: new Date().toISOString() }, { onConflict: "user_id,media_id,season,pass_key" });
    return error ? fail("Could not save that.") : ok(undefined);
  },

  async clearEdit(mediaId, season, passKey) {
    const { error } = await getSupabase().from("tv_stack_edits").delete().eq("media_id", mediaId).eq("season", season ?? -1).eq("pass_key", passKey);
    return error ? fail("Could not reset that.") : ok(undefined);
  },
};
