// hooks/useStoryMedia.ts
// Finds cut-out pictures and music for a story. Pictures are only kept when they really are cut-outs;
// the answer is remembered per story so reopening it needs no new searches.
"use client";

import { useEffect, useState } from "react";
import { isCutout } from "@/lib/color";
import { debugBypass, debugLog } from "@/lib/debug";
import type { Mood } from "@/lib/domain/storyMood";
import type { StoryTheme } from "@/lib/ports/ai";
import type { MediaPicture, MediaTrack } from "@/lib/ports/media";
import { readStored, writeStored } from "@/lib/persistentCache";
import { services } from "@/lib/services";

export interface StoryMedia {
  stickers: MediaPicture[];
  tracks: MediaTrack[];
}

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
// With a theme from the AI there are eight picture searches and room for plenty of stickers, so slides can all differ.
const WANT_STICKERS = 6;
const MAX_SEARCHES = 4;
const THEMED_STICKERS = 16;
const THEMED_SEARCHES = 8;

async function findStickers(queries: string[], themed: boolean): Promise<MediaPicture[]> {
  const found: MediaPicture[] = [];
  for (const query of queries.slice(0, themed ? THEMED_SEARCHES : MAX_SEARCHES)) {
    if (found.length >= (themed ? THEMED_STICKERS : WANT_STICKERS)) break;
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

/** Empty lists until the search is done; the story shows without them in the meantime. */
/** Waits for the story's theme (or its failure) so the searches use the AI's picks when there are any. */
export function useStoryMedia(storyKey: string | null, mood: Mood | null, theme: StoryTheme | null, themeDone: boolean): StoryMedia {
  const [media, setMedia] = useState<StoryMedia>({ stickers: [], tracks: [] });

  useEffect(() => {
    if (!storyKey || !mood || !themeDone) return;
    let cancelled = false;
    (async () => {
      const kept = debugBypass() ? undefined : readStored<StoryMedia>(`story-media:${storyKey}`, KEEP_MS);
      if (kept) return setMedia(kept);
      const [stickers, tracks] = await Promise.all([findStickers([...(theme?.pictures ?? []), ...mood.stickers], theme !== null), findTracks([...(theme ? [theme.music] : []), ...mood.music])]);
      if (cancelled) return;
      const next = { stickers, tracks };
      // Nothing found is not remembered, so a slow moment does not leave the story bare for a month.
      if (!debugBypass() && (stickers.length > 0 || tracks.length > 0)) writeStored(`story-media:${storyKey}`, next);
      setMedia(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [storyKey, mood, theme, themeDone]);

  return media;
}
