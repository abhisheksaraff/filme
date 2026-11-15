// lib/adapters/supabase/SupabaseSettingsRepository.ts
// Per-user preferences, kept in the single user_settings row.
import { z } from "zod";
import { addNewRows, ALL_ROW_IDS } from "@/lib/domain/home";
import { DEFAULT_APPEARANCE, appearanceSchema } from "@/lib/domain/appearance";
import type { MovingDates } from "@/lib/domain/holidays";
import { EMPTY_WATCH_LINKS, watchLinksSchema } from "@/lib/domain/watchLinks";
import type { SettingsRepository } from "@/lib/ports/settings";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const rowIds = z.array(z.string());

/** Says why a settings call failed, in words that point at the fix; a missing column means a migration has not been run. */
function settingsProblem(error: { code?: string; message?: string }, action: "load" | "save"): string {
  const text = error.message ?? "";
  if (error.code === "PGRST204" || error.code === "42703" || /column/i.test(text)) {
    return `Your appearance couldn't be ${action === "save" ? "saved" : "loaded"}: the database is missing a newer setting. Run the latest migration, then try again.`;
  }
  return action === "save" ? "Could not save your appearance settings." : "Could not load your appearance settings.";
}

export const supabaseSettingsRepository: SettingsRepository = {
  async homeRows() {
    const db = getSupabase();
    const { data, error } = await db.from("user_settings").select("home_layout, home_seen").maybeSingle();
    if (error) return fail("Could not load your Home layout.");
    const parsed = rowIds.safeParse(data?.home_layout);
    const layout = parsed.success ? parsed.data : [];
    if (layout.length === 0) return ok([]);

    // Rows added since the layout was saved appear once; the layout is then saved so they can be turned off.
    const seen = rowIds.safeParse(data?.home_seen);
    const merged = addNewRows(layout, seen.success ? seen.data : null);
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (userId && (merged.length !== layout.length || !seen.success)) {
      await db.from("user_settings").upsert({ user_id: userId, home_layout: merged, home_seen: [...ALL_ROW_IDS] }, { onConflict: "user_id" });
    }
    return ok(merged);
  },

  async saveHomeRows(ids) {
    const db = getSupabase();
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return fail("Your session has expired. Sign in again.");

    const { error } = await db.from("user_settings").upsert({ user_id: userId, home_layout: ids, home_seen: [...ALL_ROW_IDS] }, { onConflict: "user_id" });
    return error ? fail("Could not save your Home layout.") : ok(undefined);
  },

  async appearance() {
    const { data, error } = await getSupabase()
      .from("user_settings")
      .select("theme_mode, holiday_theme, holiday_theme_enabled, decorations_enabled, animations_enabled, birthday")
      .maybeSingle();
    if (error) return fail(settingsProblem(error, "load"));
    if (!data) return ok(DEFAULT_APPEARANCE);
    const parsed = appearanceSchema.safeParse({
      themeMode: data.theme_mode,
      holidayTheme: data.holiday_theme,
      holidayThemeEnabled: data.holiday_theme_enabled,
      animationsEnabled: data.animations_enabled,
      decorationsEnabled: data.decorations_enabled,
      birthday: data.birthday,
    });
    // An answer that cannot be read is a failure, not a reset: callers then keep the look already on the phone.
    return parsed.success ? ok(parsed.data) : fail("Your saved appearance could not be read, so the look on this phone was kept.");
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
        animations_enabled: appearance.animationsEnabled,
        decorations_enabled: appearance.decorationsEnabled,
        birthday: appearance.birthday,
      },
      { onConflict: "user_id" },
    );
    return error ? fail(settingsProblem(error, "save")) : ok(undefined);
  },

  async location() {
    const { data, error } = await getSupabase().from("user_settings").select("city, region").maybeSingle();
    if (error) return fail("Could not load your location.");
    return ok(data?.city && data.region ? { city: data.city as string, region: data.region as string } : null);
  },

  async saveLocation(location) {
    return upsertSettings({ city: location.city, region: location.region }, "Could not save your location.");
  },

  async lastBackup() {
    const { data, error } = await getSupabase().from("user_settings").select("last_backup_at").maybeSingle();
    if (error) return fail("Could not load your backup date.");
    return ok((data?.last_backup_at as string | null | undefined) ?? null);
  },

  async markBackup() {
    return upsertSettings({ last_backup_at: new Date().toISOString() }, "Could not record the backup.");
  },

  async watchLinks() {
    const { data, error } = await getSupabase().from("user_settings").select("watch_links").maybeSingle();
    if (error) return fail("Could not load your Watch links.");
    const parsed = watchLinksSchema.safeParse(data?.watch_links ?? {});
    return ok(parsed.success ? parsed.data : EMPTY_WATCH_LINKS);
  },

  async saveWatchLinks(links) {
    return upsertSettings({ watch_links: links }, "Could not save your Watch links.");
  },

  async movingDates(year) {
    const db = getSupabase();
    const { data, error } = await db
      .from("holiday_dates")
      .select("starts_on, ends_on, holiday:holidays(slug)")
      .eq("year", year);
    if (error) return fail("Could not load holiday dates.");
    const dates: MovingDates = {};
    for (const row of data) {
      const holiday = (Array.isArray(row.holiday) ? row.holiday[0] : row.holiday) as { slug: string } | null;
      if (holiday) dates[holiday.slug] = { start: row.starts_on as string, end: row.ends_on as string };
    }
    return ok(dates);
  },

  async saveMovingDates(year, dates) {
    const db = getSupabase();
    const slugs = Object.keys(dates);
    if (slugs.length === 0) return ok(undefined);
    const holidays = await db.from("holidays").select("id, slug").in("slug", slugs);
    if (holidays.error) return fail("Could not save holiday dates.");
    const rows = holidays.data.map((h) => ({
      holiday_id: h.id,
      year,
      starts_on: dates[h.slug as string].start,
      ends_on: dates[h.slug as string].end,
    }));
    const { error } = await db.from("holiday_dates").upsert(rows, { onConflict: "holiday_id,year" });
    return error ? fail("Could not save holiday dates.") : ok(undefined);
  },
};

/** Updates the user's single settings row, creating it the first time. */
async function upsertSettings(values: Record<string, unknown>, message: string) {
  const db = getSupabase();
  const { data: auth } = await db.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return fail("Your session has expired. Sign in again.");
  const { error } = await db.from("user_settings").upsert({ user_id: userId, ...values }, { onConflict: "user_id" });
  return error ? fail(message) : ok(undefined);
}
