// lib/pageMemory.ts
// Remembers what a page was showing so going Back restores it, while opening a page fresh does not.
// It lives in memory only, so closing or reloading the app starts everything clean.
"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const memory = new Map<string, unknown>();
const scrolls = new Map<string, number>();

let goingBack = false;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof window !== "undefined") {
  // popstate fires for the browser's Back and Forward, never for a tapped link.
  window.addEventListener("popstate", () => {
    goingBack = true;
    clearTimeout(clearTimer);
    // Backstop in case no tap follows: the page that Back opens has mounted long before this.
    clearTimer = setTimeout(() => {
      goingBack = false;
    }, 3000);
  });
  // Any tap starts a new forward trip, so the next page opens fresh.
  document.addEventListener(
    "pointerdown",
    () => {
      goingBack = false;
    },
    true,
  );
}

/** True while the page on screen was reached with Back. */
export const isGoingBack = (): boolean => goingBack;

/**
 * Like useState, but when the page is reached with Back it starts from what it held when it was left.
 * The key must be unique to the page and the value, and the value must not depend on the URL.
 */
export function usePageState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (goingBack && memory.has(key) ? (memory.get(key) as T) : initial));
  useEffect(() => {
    memory.set(key, value);
  }, [key, value]);
  return [value, setValue];
}

export const saveScroll = (key: string, y: number): void => void scrolls.set(key, y);

/** The scroll position to return to, only when arriving with Back. */
export const recallScroll = (key: string): number | null => (goingBack ? (scrolls.get(key) ?? null) : null);
