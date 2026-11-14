// components/Decorations.tsx
// Soft floating shapes for the active theme. They never take clicks and stay out of the way of reading.
"use client";

import { useEffect, useState } from "react";
import type { Appearance } from "@/lib/domain/appearance";
import type { Theme } from "@/lib/domain/holidays";
import { APPEARANCE_EVENT, currentTheme, readCachedAppearance } from "@/lib/theme";

const COUNT = 14;

interface Piece {
  glyph: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

/** Deterministic pseudo-random numbers so server and browser agree on where each piece sits. */
const seeded = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export default function Decorations() {
  const [state, setState] = useState<{ theme: Theme; on: boolean } | null>(null);

  useEffect(() => {
    const refresh = (appearance: Appearance) => {
      const theme = currentTheme(appearance);
      setState(theme ? { theme, on: appearance.decorationsEnabled } : null);
    };
    refresh(readCachedAppearance());
    const onChange = (event: Event) => refresh((event as CustomEvent<Appearance>).detail);
    window.addEventListener(APPEARANCE_EVENT, onChange);
    return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
  }, []);

  if (!state?.on) return null;
  const { theme } = state;
  const pieces: Piece[] = Array.from({ length: COUNT }, (_, i) => ({
    glyph: theme.glyphs[i % theme.glyphs.length],
    left: seeded(i, 1) * 100,
    size: 14 + seeded(i, 2) * 16,
    delay: -seeded(i, 3) * 14,
    duration: 12 + seeded(i, 4) * 10,
  }));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden motion-reduce:hidden">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={`deco deco-${theme.motion}`}
          style={{ left: `${piece.left}%`, fontSize: piece.size, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s` }}
        >
          {piece.glyph}
        </span>
      ))}
    </div>
  );
}
