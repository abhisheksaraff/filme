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
import { preloadTrack } from "@/lib/storyAudio";
import { services } from "@/lib/services";

export interface StoryMedia {
  stickers: MediaPicture[];
  tracks: MediaTrack[];
  /** True once the pictures are fetched and the music is downloaded, so the story can open. */
  ready: boolean;
}

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
// Eight picture searches and room for plenty of stickers, so slides can all differ.
const WANT_STICKERS = 16;
const MAX_SEARCHES = 8;

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

/** Fetches the sticker pictures so they are in the browser's cache when the story opens; a slow one is not waited for. */
async function warmPictures(urls: string[]): Promise<void> {
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

/** Empty lists until the search is done. `ready` turns true once everything is downloaded; with no theme nothing is searched. */
export function useStoryMedia(storyKey: string | null, mood: Mood | null, theme: StoryTheme | null): StoryMedia {
  const [media, setMedia] = useState<StoryMedia>({ stickers: [], tracks: [], ready: false });

  useEffect(() => {
    if (!storyKey || !mood || !theme) return;
    let cancelled = false;
    (async () => {
      const kept = debugBypass() ? undefined : readStored<{ stickers: MediaPicture[]; tracks: MediaTrack[] }>(`story-media:${storyKey}`, KEEP_MS);
      let found = kept;
      if (!found) {
        const [stickers, tracks] = await Promise.all([findStickers([...theme.pictures, ...mood.stickers]), findTracks([theme.music, ...mood.music])]);
        found = { stickers, tracks };
        // Nothing found is not remembered, so a slow moment does not leave the story bare for a month.
        if (!debugBypass() && (stickers.length > 0 || tracks.length > 0)) writeStored(`story-media:${storyKey}`, found);
      }
      if (cancelled) return;
      // The story waits here, so its pictures and first track are ready the moment it opens.
      await Promise.all([warmPictures(found.stickers.map((s) => s.url)), preloadTrack(found.tracks)]);
      if (!cancelled) setMedia({ ...found, ready: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [storyKey, mood, theme]);

  return media;
}
