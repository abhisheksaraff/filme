// hooks/useStoryTheme.ts
// Asks for a story's theme (a few captions, picture searches and one music search) when the story opens. The AI is asked once
// and the answer is kept, so reopening costs nothing; Home usually has it ready already.
"use client";

import { useEffect, useState } from "react";
import type { StoryTheme, StoryThemeInput } from "@/lib/ports/ai";
import { loadStoryTheme } from "@/lib/storyLoaders";

export interface StoryThemeState {
  /** True once there is an answer, or a failure. */
  done: boolean;
  theme: StoryTheme | null;
  /** Asks again after a failure. */
  retry: () => void;
}

/** `input` is null until the story's content is known. */
export function useStoryTheme(storyKey: string | null, input: Omit<StoryThemeInput, "recentMusic"> | null): StoryThemeState {
  const [state, setState] = useState<{ done: boolean; theme: StoryTheme | null }>({ done: false, theme: null });
  const [attempt, setAttempt] = useState(0);
  const inputKey = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!storyKey || !inputKey) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      const res = await loadStoryTheme(storyKey, JSON.parse(inputKey) as Omit<StoryThemeInput, "recentMusic">);
      if (!cancelled) setState({ done: true, theme: res.ok ? res.value : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [storyKey, inputKey, attempt]);

  const retry = () => {
    setState({ done: false, theme: null });
    setAttempt((n) => n + 1);
  };

  return { ...state, retry };
}
