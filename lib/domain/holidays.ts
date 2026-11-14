// lib/domain/holidays.ts
// Every theme the app can wear, and when each switches on by itself. A theme is a colour tint for
// the whole interface (applied by remapping the grey scale), an accent colour and floating
// decorations. Dates are worked out here; moving holidays arrive as a looked-up list.

export type Motion = "fall" | "rise" | "float";

export interface Theme {
  slug: string;
  name: string;
  emoji: string;
  /** Tint for the grey scale: hue in degrees and saturation in percent. */
  hue: number;
  sat: number;
  /** Accent colour on a light and on a dark background. */
  light: string;
  dark: string;
  /** Characters that drift across the screen, and how they move. */
  glyphs: string[];
  motion: Motion;
  /** Word used to find themed titles on TMDB. */
  search: string;
  /** First and last day (inclusive) it shows in a year, or null when it is not on that year. */
  window(year: number, context: ThemeContext): { start: Date; end: Date } | null;
}

/** Looked-up dates for holidays that move, keyed by slug, as YYYY-MM-DD. */
export type MovingDates = Record<string, { start: string; end: string }>;

export interface ThemeContext {
  moving?: MovingDates;
  /** The user's birthday as MM-DD. */
  birthday?: string | null;
}

/** Slugs of the holidays whose dates must be looked up each year. */
export const MOVING_SLUGS = ["diwali", "lunar-new-year", "eid-al-fitr", "eid-al-adha", "hanukkah"] as const;

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date);

function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return day(y, m, d);
}

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
  return day(year, month, ((h + l - 7 * m + 114) % 31) + 1);
}

/** A holiday whose dates come from the yearly lookup; it only shows for the year that was looked up. */
function moving(slug: string) {
  return (year: number, ctx: ThemeContext) => {
    const found = ctx.moving?.[slug];
    if (!found) return null;
    const start = parseDay(found.start);
    return start.getFullYear() === year ? { start, end: parseDay(found.end) } : null;
  };
}

const EID = { hue: 165, sat: 22, light: "#00796b", dark: "#5eead4", glyphs: ["🌙", "⭐", "✨"], motion: "float" as Motion, search: "eid" };

export const THEMES: readonly Theme[] = [
  { slug: "new-year", name: "New Year", emoji: "🎆", hue: 45, sat: 25, light: "#9a6b00", dark: "#ffd54a",
    glyphs: ["✨", "🎆", "🥂"], motion: "rise", search: "new year",
    window: (y) => ({ start: day(y, 12, 29), end: day(y + 1, 1, 2) }) },
  { slug: "valentines", name: "Valentine's Day", emoji: "💘", hue: 340, sat: 22, light: "#c2185b", dark: "#ff7aa8",
    glyphs: ["💗", "💘", "💖"], motion: "rise", search: "valentine",
    window: (y) => ({ start: day(y, 2, 12), end: day(y, 2, 14) }) },
  { slug: "lunar-new-year", name: "Lunar New Year", emoji: "🧧", hue: 5, sat: 28, light: "#c62828", dark: "#ffd54a",
    glyphs: ["🏮", "🧧", "✨"], motion: "fall", search: "chinese new year", window: moving("lunar-new-year") },
  { slug: "st-patricks", name: "St. Patrick's Day", emoji: "☘️", hue: 140, sat: 20, light: "#1b7f3a", dark: "#4ade80",
    glyphs: ["☘️", "🍀"], motion: "fall", search: "irish",
    window: (y) => ({ start: day(y, 3, 15), end: day(y, 3, 17) }) },
  { slug: "easter", name: "Easter", emoji: "🐣", hue: 270, sat: 18, light: "#6d4bb8", dark: "#c4b5fd",
    glyphs: ["🥚", "🐣", "🌷"], motion: "float", search: "easter",
    window: (y) => {
      const easter = easterSunday(y);
      return { start: day(y, easter.getMonth() + 1, easter.getDate() - 2), end: day(y, easter.getMonth() + 1, easter.getDate() + 1) };
    } },
  { slug: "eid-al-fitr", name: "Eid al-Fitr", emoji: "🌙", ...EID, window: moving("eid-al-fitr") },
  { slug: "eid-al-adha", name: "Eid al-Adha", emoji: "🌙", ...EID, window: moving("eid-al-adha") },
  { slug: "canada-day", name: "Canada Day", emoji: "🍁", hue: 0, sat: 18, light: "#c62828", dark: "#ff6b6b",
    glyphs: ["🍁"], motion: "fall", search: "canada",
    window: (y) => ({ start: day(y, 6, 30), end: day(y, 7, 1) }) },
  { slug: "birthday", name: "Birthday", emoji: "🎂", hue: 300, sat: 22, light: "#ad1fa3", dark: "#f0abfc",
    glyphs: ["🎈", "🎉", "🎊"], motion: "rise", search: "birthday",
    window: (y, ctx) => {
      const match = /^(\d{2})-(\d{2})$/.exec(ctx.birthday ?? "");
      if (!match) return null;
      const month = Number(match[1]);
      const date = Number(match[2]);
      return { start: day(y, month, date - 1), end: day(y, month, date + 1) };
    } },
  { slug: "diwali", name: "Diwali", emoji: "🪔", hue: 35, sat: 30, light: "#e65100", dark: "#ffb300",
    glyphs: ["🪔", "✨", "🎇"], motion: "rise", search: "diwali", window: moving("diwali") },
  { slug: "halloween", name: "Halloween", emoji: "🎃", hue: 25, sat: 28, light: "#d84315", dark: "#ff9800",
    glyphs: ["🎃", "🦇", "👻"], motion: "float", search: "halloween",
    window: (y) => ({ start: day(y, 10, 24), end: day(y, 10, 31) }) },
  { slug: "hanukkah", name: "Hanukkah", emoji: "🕎", hue: 215, sat: 28, light: "#1565c0", dark: "#90caf9",
    glyphs: ["🕎", "✨", "⭐"], motion: "fall", search: "hanukkah", window: moving("hanukkah") },
  { slug: "christmas", name: "Christmas", emoji: "🎄", hue: 355, sat: 22, light: "#b71c1c", dark: "#ff6b6b",
    glyphs: ["❄️", "❅", "🎄"], motion: "fall", search: "christmas",
    window: (y) => ({ start: day(y, 12, 18), end: day(y, 12, 26) }) },
];

/** Kept for code that lists the holidays. */
export const HOLIDAYS = THEMES;

export function themeBySlug(slug: string | null | undefined): Theme | null {
  return THEMES.find((theme) => theme.slug === slug) ?? null;
}

export interface ThemeChoice {
  holidayThemeEnabled: boolean;
  /** A theme slug to show whatever the date is; null follows the calendar. */
  holidayTheme: string | null;
}

/** The theme to wear, or null for the plain look. A chosen theme shows whatever the date is. */
export function activeHoliday(now: Date, choice: ThemeChoice, context: ThemeContext = {}): Theme | null {
  if (choice.holidayTheme) return themeBySlug(choice.holidayTheme);
  if (!choice.holidayThemeEnabled) return null;

  const today = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
  for (const theme of THEMES) {
    // Check neighbouring years too, because New Year's window crosses the new year.
    for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const window = theme.window(year, context);
      if (window && today >= window.start && today <= window.end) return theme;
    }
  }
  return null;
}

const LIGHTNESS = { 50: 98, 100: 97, 200: 94, 300: 86, 400: 62, 500: 46, 600: 36, 700: 28, 800: 18, 900: 11, 950: 6 };

/**
 * CSS variables that tint the interface. Tailwind's grey scale is remapped so every existing
 * `neutral` class picks up the theme; the plain look returns nothing and keeps its pure greys.
 */
export function themeVars(theme: Theme | null, dark: boolean): Record<string, string> {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  for (const [step, lightness] of Object.entries(LIGHTNESS)) {
    vars[`--color-neutral-${step}`] = `hsl(${theme.hue} ${theme.sat}% ${lightness}%)`;
  }
  vars["--background"] = dark ? `hsl(${theme.hue} ${theme.sat}% 6%)` : `hsl(${theme.hue} ${Math.round(theme.sat * 0.6)}% 98%)`;
  vars["--foreground"] = dark ? `hsl(${theme.hue} ${Math.round(theme.sat * 0.4)}% 93%)` : `hsl(${theme.hue} ${theme.sat}% 9%)`;
  vars["--accent"] = dark ? theme.dark : theme.light;
  return vars;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Finds the first day of the year where a calendar system reports the given month and day. */
function findDay(year: number, calendar: string, match: (month: string, day: number) => boolean, span = 1): { start: string; end: string } | null {
  const format = new Intl.DateTimeFormat("en-u-ca-" + calendar, { month: calendar === "hebrew" ? "long" : "numeric", day: "numeric" });
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const parts = format.formatToParts(d);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (match(month, day)) return { start: iso(d), end: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + span - 1)) };
  }
  return null;
}

/**
 * Dates worked out on the device from the Chinese, Islamic and Hebrew calendars. Used when the
 * yearly lookup is unavailable. Diwali follows the Hindu calendar, which the browser does not
 * have, so it only comes from the lookup.
 */
export function fallbackMovingDates(year: number): MovingDates {
  const found: MovingDates = {};
  try {
    const lunar = findDay(year, "chinese", (m, d) => m === "1" && d === 1, 3);
    if (lunar) found["lunar-new-year"] = lunar;
    const fitr = findDay(year, "islamic-umalqura", (m, d) => m === "10" && d === 1, 3);
    if (fitr) found["eid-al-fitr"] = fitr;
    const adha = findDay(year, "islamic-umalqura", (m, d) => m === "12" && d === 10, 3);
    if (adha) found["eid-al-adha"] = adha;
    const hanukkah = findDay(year, "hebrew", (m, d) => m === "Kislev" && d === 25, 8);
    if (hanukkah) found.hanukkah = hanukkah;
  } catch {
    // A browser without these calendars simply has no fallback.
  }
  return found;
}
