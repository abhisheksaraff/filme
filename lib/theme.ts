// lib/theme.ts
// Applies the look (light or dark, holiday tint) to the page and remembers it for the next visit.
import { DEFAULT_APPEARANCE, appearanceSchema, wantsDark, type Appearance } from "@/lib/domain/appearance";
import { activeHoliday } from "@/lib/domain/holidays";

const KEY = "filme-appearance";
/** Fired on window after a change so the page updates without a reload. */
export const APPEARANCE_EVENT = "filme:appearance";

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

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  const dark = wantsDark(appearance.themeMode, matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);

  const holiday = activeHoliday(new Date(), appearance);
  if (holiday) {
    root.dataset.holiday = holiday.slug;
    root.style.setProperty("--accent", dark ? holiday.dark : holiday.light);
  } else {
    delete root.dataset.holiday;
    root.style.removeProperty("--accent");
  }
}

/** Saves, applies and announces a new look in one step. */
export function changeAppearance(appearance: Appearance): void {
  cacheAppearance(appearance);
  applyAppearance(appearance);
  window.dispatchEvent(new CustomEvent<Appearance>(APPEARANCE_EVENT, { detail: appearance }));
}
