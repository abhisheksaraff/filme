// lib/foldedHeight.ts
// How tall the tallest folded viewing card on a page is, so on wide screens every folded card can be that tall. Opening one
// card then grows only that card: the others keep this height instead of stretching with it.
import { useSyncExternalStore } from "react";

const byPage = new Map<string, Map<string, number>>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const tallest = (page: string) => Math.max(0, ...(byPage.get(page)?.values() ?? []));

/** A card tells the page how tall its folded content is; null when it goes away. */
export function reportFolded(page: string, card: string, height: number | null): void {
  const cards = byPage.get(page) ?? new Map<string, number>();
  if (height === null) cards.delete(card);
  else if (cards.get(card) === height) return;
  else cards.set(card, height);
  byPage.set(page, cards);
  listeners.forEach((l) => l());
}

/** The tallest folded height reported for the page, in px; 0 until a card has measured itself. */
export function useTallestFolded(page: string): number {
  return useSyncExternalStore(subscribe, () => tallest(page), () => 0);
}
