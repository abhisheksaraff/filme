// lib/adapters/supabase/SupabaseSettingsRepository.ts
// Per-user preferences, kept in the single user_settings row.
import { z } from "zod";
import type { SettingsRepository } from "@/lib/ports/settings";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const rowIds = z.array(z.string());

export const supabaseSettingsRepository: SettingsRepository = {
  async homeRows() {
    const { data, error } = await getSupabase().from("user_settings").select("home_layout").maybeSingle();
    if (error) return fail("Could not load your Home layout.");
    const parsed = rowIds.safeParse(data?.home_layout);
    return ok(parsed.success ? parsed.data : []);
  },

  async saveHomeRows(ids) {
    const db = getSupabase();
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return fail("Your session has expired. Sign in again.");

    const { error } = await db.from("user_settings").upsert({ user_id: userId, home_layout: ids }, { onConflict: "user_id" });
    return error ? fail("Could not save your Home layout.") : ok(undefined);
  },
};
