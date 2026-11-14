// lib/domain/settings.ts
import { z } from "zod";

export const themeModeSchema = z.enum(["light", "dark", "system"]);

/** Per-user preferences stored as one row so new settings never need a migration per field. */
export const userSettingsSchema = z.object({
  themeMode: themeModeSchema,
  holidayTheme: z.string().nullable(),
  holidayThemeEnabled: z.boolean(),
  homeLayout: z.array(z.string()),
  /** Year the moving-holiday dates were last fetched, so the yearly refresh runs once. */
  holidayDatesYear: z.number().int().nullable(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
