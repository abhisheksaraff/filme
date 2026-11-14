// lib/domain/appearance.ts
// How the app looks: light or dark, and whether holiday themes are on.
import { z } from "zod";
import { themeModeSchema } from "./settings";

export const appearanceSchema = z.object({
  themeMode: themeModeSchema,
  holidayThemeEnabled: z.boolean(),
  /** A holiday slug to show regardless of the date; null follows the calendar. */
  holidayTheme: z.string().nullable(),
});
export type Appearance = z.infer<typeof appearanceSchema>;

export const DEFAULT_APPEARANCE: Appearance = { themeMode: "system", holidayThemeEnabled: true, holidayTheme: null };

export function wantsDark(mode: Appearance["themeMode"], systemPrefersDark: boolean): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark);
}
