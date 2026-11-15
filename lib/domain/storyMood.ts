// lib/domain/storyMood.ts
// What a story should look and sound like: its base colour, which cut-out pictures to look for and what
// music to look for, from the period it covers and the festival on that day, if any.
import { activeHoliday, type MovingDates, type Theme } from "./holidays";
import type { StoryKind } from "./stories";

export interface Mood {
  /** Base hue in degrees, used for slides with no poster of their own. */
  hue: number;
  holiday: Theme | null;
  /** Phrases to search for cut-out pictures, best first. */
  stickers: string[];
  /** Phrases to search for music, best first. */
  music: string[];
}

const SEASON_HUE = { winter: 215, spring: 140, summer: 32, autumn: 18 } as const;
const SEASON_MUSIC = {
  winter: "calm piano winter instrumental",
  spring: "gentle acoustic spring instrumental",
  summer: "warm chill summer instrumental",
  autumn: "cozy autumn acoustic instrumental",
} as const;

/** What to look for on each festival's days; the first words describe the picture, the rest are fallbacks. */
const FESTIVAL: Record<string, { stickers: string[]; music: string[] }> = {
  "new-year": { stickers: ["fireworks", "champagne", "party popper"], music: ["new year celebration instrumental", "upbeat party instrumental"] },
  valentines: { stickers: ["red rose", "heart", "love letter"], music: ["romantic piano instrumental", "soft love acoustic instrumental"] },
  "lunar-new-year": { stickers: ["red lantern", "dragon", "red envelope"], music: ["chinese new year instrumental", "guzheng instrumental"] },
  "st-patricks": { stickers: ["shamrock", "pot of gold", "leprechaun hat"], music: ["celtic folk instrumental", "irish fiddle instrumental"] },
  easter: { stickers: ["easter egg", "bunny", "tulip"], music: ["spring acoustic instrumental", "gentle spring piano"] },
  "eid-al-fitr": { stickers: ["crescent moon", "lantern", "mosque"], music: ["oud instrumental", "calm middle eastern instrumental"] },
  "eid-al-adha": { stickers: ["crescent moon", "lantern", "mosque"], music: ["oud instrumental", "calm middle eastern instrumental"] },
  "canada-day": { stickers: ["maple leaf", "fireworks", "canadian flag"], music: ["folk acoustic summer instrumental", "upbeat acoustic instrumental"] },
  birthday: { stickers: ["birthday cake", "party hat", "balloons"], music: ["happy upbeat instrumental", "party instrumental"] },
  diwali: { stickers: ["diya lamp", "rangoli", "firework"], music: ["sitar instrumental", "indian classical instrumental"] },
  halloween: { stickers: ["jack o lantern", "ghost", "witch hat"], music: ["spooky ambient instrumental", "halloween instrumental"] },
  hanukkah: { stickers: ["menorah", "dreidel", "star of david"], music: ["hanukkah instrumental", "klezmer instrumental"] },
  christmas: { stickers: ["christmas ornament", "candy cane", "snowman"], music: ["christmas bells instrumental", "festive piano instrumental"] },
};

/** Things that suit a film log on any day. */
const GENERAL_STICKERS = ["disco ball", "popcorn", "film reel", "3d glasses", "movie ticket", "clapperboard", "microphone", "vinyl record", "cinema camera"];

function seasonOf(month: number): keyof typeof SEASON_HUE {
  return month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
}

/** A number from a string, so the same story always picks the same stickers. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** The festival on a given day, or null. It does not depend on the user's theme settings. */
export function festivalOn(date: Date, moving: MovingDates): Theme | null {
  return activeHoliday(date, { holidayThemeEnabled: true, holidayTheme: null }, { moving });
}

/** The mood of a story. Only a day story takes on a festival; months and years take their season. */
export function moodFor(kind: StoryKind, period: string, moving: MovingDates): Mood {
  const month = Number(period.slice(5, 7)) || 6;
  const season = seasonOf(kind === "year" ? 6 : month);
  const holiday = kind === "day" ? festivalOn(new Date(Number(period.slice(0, 4)), month - 1, Number(period.slice(8, 10))), moving) : null;
  const festival = holiday ? FESTIVAL[holiday.slug] : undefined;

  // Rotate the general list by the period so each story gets its own picks.
  const start = hash(period) % GENERAL_STICKERS.length;
  const general = [...GENERAL_STICKERS.slice(start), ...GENERAL_STICKERS.slice(0, start)];
  const yearly = kind === "year" ? ["cinematic orchestral instrumental"] : [];

  return {
    hue: holiday ? holiday.hue : SEASON_HUE[season],
    holiday,
    stickers: [...(festival?.stickers ?? []), ...general],
    music: [...(festival?.music ?? []), ...yearly, SEASON_MUSIC[season]],
  };
}
