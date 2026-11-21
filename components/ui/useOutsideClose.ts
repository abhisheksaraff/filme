// components/ui/useOutsideClose.ts
// Calls close when a tap or click lands outside the element, so a suggestion list can go away without losing the typed text.
"use client";

import { useEffect, type RefObject } from "react";

export function useOutsideClose(ref: RefObject<HTMLElement | null>, active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, active, close]);
}
