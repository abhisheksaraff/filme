// hooks/useStoryTheme.ts
// Asks the AI once for a story's mood (a few captions, picture searches and one music search) and keeps the answer, so
// reopening the story costs nothing. If the AI fails or has no key, the story falls back to its generic searches.
"use client";

import { useEffect, useState } from "react";
import { debugLog } from "@/lib/debug";
import type { StoryTheme, StoryThemeInput } from "@/lib/ports/ai";
import { readStored, writeStored } from "@/lib/persistentCache";
import { fail } from "@/lib/ports/result";
import { services } from "@/lib/services";

/** A request with no reply by then counts as failed, so the story never waits for ever. */
const GIVE_UP_MS = 60_000;
const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const RECENT_KEY = "filme-story-music";

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

export interface StoryThemeState {
  /** True once there is an answer, or a failure; the story's own searches wait for this. */
  done: boolean;
  theme: StoryTheme | null;
  /** Asks again after a failure. */
  retry: () => void;
}

/** `input` is null until the story's content is known. `fresh` skips what was saved, for the debug story. */
export function useStoryTheme(storyKey: string | null, input: Omit<StoryThemeInput, "recentMusic"> | null, fresh: boolean): StoryThemeState {
  const [state, setState] = useState<{ done: boolean; theme: StoryTheme | null }>({ done: false, theme: null });
  const [attempt, setAttempt] = useState(0);
  const inputKey = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!storyKey || !inputKey) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      const kept = fresh ? undefined : readStored<StoryTheme>(`story-theme:${storyKey}`, KEEP_MS);
      if (kept) {
        debugLog(`theme: saved, music "${kept.music}"`);
        return !cancelled && setState({ done: true, theme: kept });
      }
      debugLog("theme: asking the AI");
      const res = await Promise.race([
        services.ai.storyTheme({ ...(JSON.parse(inputKey) as Omit<StoryThemeInput, "recentMusic">), recentMusic: recentMusic() }),
        new Promise<ReturnType<typeof fail>>((resolve) => setTimeout(() => resolve(fail("The AI took too long to answer.")), GIVE_UP_MS)),
      ]);
      if (cancelled) return;
      if (res.ok) {
        debugLog(`theme: asked the AI, music "${res.value.music}", ${res.value.pictures.length} pictures, ${res.value.lines.length} lines`);
        if (!fresh) writeStored(`story-theme:${storyKey}`, res.value);
        rememberMusic(res.value.music);
        setState({ done: true, theme: res.value });
      } else {
        debugLog(`theme: ${res.error.slice(0, 70)}`);
        setState({ done: true, theme: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyKey, inputKey, fresh, attempt]);

  const retry = () => {
    setState({ done: false, theme: null });
    setAttempt((n) => n + 1);
  };

  return { ...state, retry };
}
