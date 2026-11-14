// lib/domain/holidays.ts
// Holidays that tint the app. Dates are worked out here (no lookup), so this needs no server.
import type { Appearance } from "./appearance";

export interface Holiday {
  slug: string;
  name: string;
  emoji: string;
  /** Accent colour on a light and on a dark background. */
  light: string;
  dark: string;
  /** Word used to find themed titles on TMDB. */
  search: string;
  /** First and last day (inclusive) the theme shows in the given year. */
  window(year: number): { start: Date; end: Date };
}

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date);

/** Easter Sunday by the Gregorian computus. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const date = ((h + l - 7 * m + 114) % 31) + 1;
  return day(year, month, date);
}

export const HOLIDAYS: readonly Holiday[] = [
  { slug: "new-year", name: "New Year", emoji: "🎆", light: "#9a6b00", dark: "#ffd54a", search: "new year",
    window: (y) => ({ start: day(y, 12, 29), end: day(y + 1, 1, 2) }) },
  { slug: "valentines", name: "Valentine's Day", emoji: "💘", light: "#c2185b", dark: "#ff7aa8", search: "valentine",
    window: (y) => ({ start: day(y, 2, 12), end: day(y, 2, 14) }) },
  { slug: "st-patricks", name: "St. Patrick's Day", emoji: "☘️", light: "#1b7f3a", dark: "#4ade80", search: "irish",
    window: (y) => ({ start: day(y, 3, 15), end: day(y, 3, 17) }) },
  { slug: "easter", name: "Easter", emoji: "🐣", light: "#6d4bb8", dark: "#c4b5fd", search: "easter",
    window: (y) => {
      const easter = easterSunday(y);
      return { start: day(y, easter.getMonth() + 1, easter.getDate() - 2), end: day(y, easter.getMonth() + 1, easter.getDate() + 1) };
    } },
  { slug: "canada-day", name: "Canada Day", emoji: "🍁", light: "#c62828", dark: "#ff6b6b", search: "canada",
    window: (y) => ({ start: day(y, 6, 30), end: day(y, 7, 1) }) },
  { slug: "halloween", name: "Halloween", emoji: "🎃", light: "#d84315", dark: "#ff9800", search: "halloween",
    window: (y) => ({ start: day(y, 10, 24), end: day(y, 10, 31) }) },
  { slug: "christmas", name: "Christmas", emoji: "🎄", light: "#b71c1c", dark: "#ff6b6b", search: "christmas",
    window: (y) => ({ start: day(y, 12, 18), end: day(y, 12, 26) }) },
];

/** The holiday to theme the app for, or null. A chosen holiday shows whatever the date is. */
export function activeHoliday(now: Date, settings: Pick<Appearance, "holidayThemeEnabled" | "holidayTheme">): Holiday | null {
  if (!settings.holidayThemeEnabled) return null;
  if (settings.holidayTheme) return HOLIDAYS.find((h) => h.slug === settings.holidayTheme) ?? null;

  const today = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
  for (const holiday of HOLIDAYS) {
    // Check neighbouring years too, because New Year's window crosses the new year.
    for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const { start, end } = holiday.window(year);
      if (today >= start && today <= end) return holiday;
    }
  }
  return null;
}
