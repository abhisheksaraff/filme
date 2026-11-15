// lib/storyLoaders.ts
// Everything a story needs before it can open: the AI's theme, the sticker pictures and the music. The story page asks for
// these when opened, and Home asks ahead of time for the stories it shows, so they are usually ready by the first tap.
import { isCutout } from "@/lib/color";
import { debugBypass, debugLog } from "@/lib/debug";
import { moodFor, type Mood } from "@/lib/domain/storyMood";
import { buildStory, storyTitle, type Slide, type StoryKind } from "@/lib/domain/stories";
import { readStored, writeStored } from "@/lib/persistentCache";
import type { StoryTheme, StoryThemeInput } from "@/lib/ports/ai";
import type { MediaPicture, MediaTrack } from "@/lib/ports/media";
import { fail, type Result } from "@/lib/ports/result";
import type { StatRow } from "@/lib/domain/stats";
import { saveFirstTrack } from "@/lib/storyAudio";
import { readCachedMoving } from "@/lib/theme";
import { services } from "@/lib/services";

export interface StoryMediaFound {
  stickers: MediaPicture[];
  tracks: MediaTrack[];
}

/** A request with no reply by then counts as failed, so a story never waits for ever. */
const GIVE_UP_MS = 60_000;
const THEME_KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const MEDIA_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_KEY = "filme-story-music";
// Eight picture searches and room for plenty of stickers, so slides can all differ.
const WANT_STICKERS = 16;
const MAX_SEARCHES = 8;

/** Music searches used for the last few stories, newest first. */
function recentMusic(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

function rememberMusic(term: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...recentMusic().filter((t) => t !== term)].slice(0, 3)));
  } catch {
    // Not remembered; the next story just may not be told to avoid it.
  }
}

/** What the AI is told about a story: its own headlines, the festival and the season. */
export function storyThemeInput(slides: Slide[], mood: Mood, label: string): Omit<StoryThemeInput, "recentMusic"> {
  return {
    label,
    titles: slides.filter((s) => s.heading !== "Checks").map((s) => `${s.heading}: ${s.big}`).slice(0, 25),
    places: [],
    festival: mood.holiday?.name ?? null,
    season: mood.season,
  };
}

/** The story's theme: the saved one when there is one, otherwise asked of the AI (and saved). `fresh` ignores and skips saving. */
export async function loadStoryTheme(storyKey: string, input: Omit<StoryThemeInput, "recentMusic">, fresh: boolean): Promise<Result<StoryTheme>> {
  const kept = fresh ? undefined : readStored<StoryTheme>(`story-theme:${storyKey}`, THEME_KEEP_MS);
  if (kept) {
    debugLog(`theme: saved, music "${kept.music}"`);
    return { ok: true, value: kept };
  }
  debugLog("theme: asking the AI");
  const res = await Promise.race([
    services.ai.storyTheme({ ...input, recentMusic: recentMusic() }),
    new Promise<Result<never>>((resolve) => setTimeout(() => resolve(fail("The AI took too long to answer.")), GIVE_UP_MS)),
  ]);
  if (!res.ok) {
    debugLog(`theme: ${res.error.slice(0, 70)}`);
    return res;
  }
  debugLog(`theme: asked the AI, music "${res.value.music}", ${res.value.pictures.length} pictures, ${res.value.lines.length} lines`);
  if (!fresh) writeStored(`story-theme:${storyKey}`, res.value);
  rememberMusic(res.value.music);
  return res;
}

async function findStickers(queries: string[]): Promise<MediaPicture[]> {
  const found: MediaPicture[] = [];
  for (const query of queries.slice(0, MAX_SEARCHES)) {
    if (found.length >= WANT_STICKERS) break;
    const candidates = (await services.media.pictures(query)).slice(0, 5);
    const clean = await Promise.all(candidates.map(async (c) => ((await isCutout(c.url)) ? c : null)));
    const good = clean.filter((c): c is MediaPicture => c !== null);
    debugLog(`stickers "${query}": ${candidates.length} pictures, ${good.length} cut-outs`);
    found.push(...good.slice(0, 2));
  }
  return found;
}

async function findTracks(queries: string[]): Promise<MediaTrack[]> {
  for (const query of queries.slice(0, 2)) {
    const tracks = await services.media.music(query);
    debugLog(`music "${query}": ${tracks.length} tracks of 1 to 5 minutes`);
    if (tracks.length > 0) return tracks.slice(0, 4);
  }
  return [];
}

/** The story's sticker pictures and music: the saved ones, or searched for using the AI's picks. */
export async function loadStoryMedia(storyKey: string, mood: Mood, theme: StoryTheme): Promise<StoryMediaFound> {
  const kept = debugBypass() ? undefined : readStored<StoryMediaFound>(`story-media:${storyKey}`, MEDIA_KEEP_MS);
  if (kept) return kept;
  const [stickers, tracks] = await Promise.all([findStickers([...theme.pictures, ...mood.stickers]), findTracks([theme.music, ...mood.music])]);
  const found = { stickers, tracks };
  // Nothing found is not remembered, so a slow moment does not leave the story bare for a month.
  if (!debugBypass() && (stickers.length > 0 || tracks.length > 0)) writeStored(`story-media:${storyKey}`, found);
  return found;
}

/** Fetches the sticker pictures so they are in the browser's cache when the story opens; a slow one is not waited for. */
export async function warmPictures(urls: string[]): Promise<void> {
  const loads = urls.map(async (url) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await img.decode();
    } catch {
      // A picture that will not load is simply not shown later.
    }
  });
  await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 8000))]);
}

const prepared = new Set<string>();

/**
 * Gets the given stories ready in the background, one after another so the picture and music searches stay within their
 * limits: the theme, the stickers and a music file kept on the phone. A story already prepared this visit is skipped, and
 * any failure just leaves that story to be prepared when it is opened.
 */
export async function prepareStories(rows: StatRow[], stories: { kind: StoryKind; period: string }[]): Promise<void> {
  for (const { kind, period } of stories) {
    const storyKey = `${kind}:${period}`;
    if (prepared.has(storyKey)) continue;
    prepared.add(storyKey);
    try {
      const slides = buildStory(rows, kind, period);
      if (slides.length === 0) continue;
      const mood = moodFor(kind, period, readCachedMoving());
      const theme = await loadStoryTheme(storyKey, storyThemeInput(slides, mood, storyTitle(kind, period)), false);
      if (!theme.ok) {
        prepared.delete(storyKey);
        continue;
      }
      const media = await loadStoryMedia(storyKey, mood, theme.value);
      await warmPictures(media.stickers.map((s) => s.url));
      // The track that could be saved goes first, so opening the story plays from the phone's own copy.
      const tracks = await saveFirstTrack(media.tracks);
      if (tracks.length > 0 && tracks[0].url !== media.tracks[0]?.url) writeStored(`story-media:${storyKey}`, { ...media, tracks });
    } catch {
      prepared.delete(storyKey);
    }
  }
}
