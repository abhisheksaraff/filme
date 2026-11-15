// components/decor/useDecor.ts
// Which theme is showing and which kinds of decoration are switched on, kept in step with the saved look.
"use client";

import { useEffect, useState } from "react";
import type { Appearance } from "@/lib/domain/appearance";
import type { Theme } from "@/lib/domain/holidays";
import { APPEARANCE_EVENT, currentTheme, readCachedAppearance } from "@/lib/theme";

export interface DecorState {
  theme: Theme | null;
  /** Moving backgrounds: snow, fireworks, walkers and the like. */
  animations: boolean;
  /** Still pieces: string lights, garlands and small accents. */
  decorations: boolean;
}

const NONE: DecorState = { theme: null, animations: false, decorations: false };

export function useDecor(): DecorState {
  const [state, setState] = useState<DecorState>(NONE);

  useEffect(() => {
    const refresh = (appearance: Appearance) => {
      const theme = currentTheme(appearance);
      setState(theme ? { theme, animations: appearance.animationsEnabled, decorations: appearance.decorationsEnabled } : NONE);
    };
    // The cached look is only readable in the browser, so it is read after the first paint.
    const first = setTimeout(() => refresh(readCachedAppearance()), 0);
    const onChange = (event: Event) => refresh((event as CustomEvent<Appearance>).detail);
    window.addEventListener(APPEARANCE_EVENT, onChange);
    return () => {
      clearTimeout(first);
      window.removeEventListener(APPEARANCE_EVENT, onChange);
    };
  }, []);

  return state;
}
