// lib/domain/appearance.ts
// How the app looks: light or dark, which theme, and whether decorations float around.
import { z } from "zod";
import { themeModeSchema } from "./settings";

export const appearanceSchema = z.object({
  themeMode: themeModeSchema,
  /** Switch themes by the calendar. When off (and no theme is chosen) the plain look is used. */
  holidayThemeEnabled: z.boolean(),
  /** A theme slug to show regardless of the date; null follows the calendar. */
  holidayTheme: z.string().nullable(),
  /** Moving backgrounds: snow, fireworks, walkers and the like. */
  animationsEnabled: z.boolean().default(true),
  /** Still pieces: string lights, garlands and small accents. */
  decorationsEnabled: z.boolean(),
  /** MM-DD, for the birthday theme. */
  birthday: z.string().regex(/^\d{2}-\d{2}$/).nullable(),
});
export type Appearance = z.infer<typeof appearanceSchema>;

export const DEFAULT_BIRTHDAY = "08-25";

export const DEFAULT_APPEARANCE: Appearance = {
  themeMode: "system",
  holidayThemeEnabled: true,
  holidayTheme: null,
  animationsEnabled: true,
  decorationsEnabled: true,
  birthday: DEFAULT_BIRTHDAY,
};

export function wantsDark(mode: Appearance["themeMode"], systemPrefersDark: boolean): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark);
}
