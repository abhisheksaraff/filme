// lib/adapters/supabase/SupabaseSettingsRepository.ts
// Per-user preferences, kept in the single user_settings row.
import { z } from "zod";
import { DEFAULT_APPEARANCE, appearanceSchema } from "@/lib/domain/appearance";
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

  async appearance() {
    const { data, error } = await getSupabase()
      .from("user_settings")
      .select("theme_mode, holiday_theme, holiday_theme_enabled")
      .maybeSingle();
    if (error) return fail("Could not load your appearance settings.");
    if (!data) return ok(DEFAULT_APPEARANCE);
    const parsed = appearanceSchema.safeParse({
      themeMode: data.theme_mode,
      holidayTheme: data.holiday_theme,
      holidayThemeEnabled: data.holiday_theme_enabled,
    });
    return ok(parsed.success ? parsed.data : DEFAULT_APPEARANCE);
  },

  async saveAppearance(appearance) {
    const db = getSupabase();
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return fail("Your session has expired. Sign in again.");

    const { error } = await db.from("user_settings").upsert(
      {
        user_id: userId,
        theme_mode: appearance.themeMode,
        holiday_theme: appearance.holidayTheme,
        holiday_theme_enabled: appearance.holidayThemeEnabled,
      },
      { onConflict: "user_id" },
    );
    return error ? fail("Could not save your appearance settings.") : ok(undefined);
  },
};
