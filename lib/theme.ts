// lib/theme.ts
// Applies the look (light or dark, theme tint, decorations) to the page and remembers it for the next visit.
import { DEFAULT_APPEARANCE, appearanceSchema, wantsDark, type Appearance } from "@/lib/domain/appearance";
import { THEMES, activeHoliday, themeVars, type MovingDates } from "@/lib/domain/holidays";

const KEY = "filme-appearance";
const MOVING_KEY = "filme-moving-dates";
/** Fired on window after a change so the page updates without a reload. */
export const APPEARANCE_EVENT = "filme:appearance";

/** Every CSS variable a theme may set, so switching themes can clear the old ones. */
const ALL_VARS = [
  ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => `--color-neutral-${n}`),
  "--background", "--foreground", "--accent",
];

export function readCachedAppearance(): Appearance {
  try {
    const parsed = appearanceSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function cacheAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
  } catch {
    // Private browsing can refuse storage; the look then simply resets next visit.
  }
}

export function readCachedMoving(): MovingDates {
  try {
    const value = JSON.parse(localStorage.getItem(MOVING_KEY) ?? "{}");
    return value && typeof value === "object" ? (value as MovingDates) : {};
  } catch {
    return {};
  }
}

export function cacheMoving(dates: MovingDates): void {
  try {
    localStorage.setItem(MOVING_KEY, JSON.stringify(dates));
  } catch {
    // Same as above: the dates are fetched again next visit.
  }
}

/** The theme that is active right now for this appearance, or null for the plain look. */
export function currentTheme(appearance: Appearance, now = new Date()) {
  return activeHoliday(now, appearance, { moving: readCachedMoving(), birthday: appearance.birthday });
}

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  const dark = wantsDark(appearance.themeMode, matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);

  for (const name of ALL_VARS) root.style.removeProperty(name);
  const theme = currentTheme(appearance);
  if (theme) {
    root.dataset.holiday = theme.slug;
    for (const [name, value] of Object.entries(themeVars(theme, dark))) root.style.setProperty(name, value);
  } else {
    delete root.dataset.holiday;
  }
}

/** Saves, applies and announces a new look in one step. */
export function changeAppearance(appearance: Appearance): void {
  cacheAppearance(appearance);
  applyAppearance(appearance);
  window.dispatchEvent(new CustomEvent<Appearance>(APPEARANCE_EVENT, { detail: appearance }));
}

export { THEMES };
