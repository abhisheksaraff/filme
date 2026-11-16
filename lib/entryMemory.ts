// lib/entryMemory.ts
// Keeps a half-filled New entry form while the app stays open, so leaving the page to check something does not lose it.
// It lives in memory only: saving, "Clear all" or closing the app empties it.
import type { EntryDraft } from "@/components/entryDraft";
import type { CoverChoice } from "@/components/PosterChooser";
import type { CatalogDetails } from "@/lib/ports/catalog";

export interface EntryMemory {
  draft: EntryDraft;
  match: CatalogDetails | null;
  poster: CoverChoice;
  backdrop: CoverChoice;
  images: string[];
  photos: { blob: Blob; url: string }[];
}

let saved: EntryMemory | null = null;

export const recallEntry = (): EntryMemory | null => saved;
export const rememberEntry = (next: EntryMemory): void => {
  saved = next;
};
export const forgetEntry = (): void => {
  saved = null;
};
