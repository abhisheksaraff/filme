// hooks/useStoryMedia.ts
// Gets a story's cut-out pictures and music ready when it opens. Pictures are only kept when they really are cut-outs;
// the answer is remembered per story, and Home usually has done all of it already.
"use client";

import { useEffect, useState } from "react";
import type { Mood } from "@/lib/domain/storyMood";
import type { StoryTheme } from "@/lib/ports/ai";
import type { MediaPicture, MediaTrack } from "@/lib/ports/media";
import { loadStoryMedia, warmPictures } from "@/lib/storyLoaders";
import { preloadTrack } from "@/lib/storyAudio";

export interface StoryMedia {
  stickers: MediaPicture[];
  tracks: MediaTrack[];
  /** True once the pictures are fetched and the music is downloaded, so the story can open. */
  ready: boolean;
}

/** Empty lists until everything is ready; with no theme nothing is searched. */
export function useStoryMedia(storyKey: string | null, mood: Mood | null, theme: StoryTheme | null): StoryMedia {
  const [media, setMedia] = useState<StoryMedia>({ stickers: [], tracks: [], ready: false });

  useEffect(() => {
    if (!storyKey || !mood || !theme) return;
    let cancelled = false;
    (async () => {
      const found = await loadStoryMedia(storyKey, mood, theme);
      if (cancelled) return;
      // The story waits here, so its pictures and music are ready the moment it opens.
      await Promise.all([warmPictures(found.stickers.map((s) => s.url)), preloadTrack(found.tracks)]);
      if (!cancelled) setMedia({ ...found, ready: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [storyKey, mood, theme]);

  return media;
}
