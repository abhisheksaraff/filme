// lib/ports/wanted.ts
import type { CatalogDetails, CatalogKind } from "./catalog";
import type { Result } from "./result";

/** A title saved to watch later. */
export interface WantedItem {
  mediaId: string;
  tmdbId: number | null;
  category: string;
  title: string;
  posterPath: string | null;
}

/** A Watchlist item that was cleared by watching the title. */
export interface ClearedItem {
  addedAt: string;
  clearedAt: string;
}

/** Where a catalogue title stands in the user's own data. */
export interface TitleStatus {
  /** Our own id for the title, once it has been saved for any reason. */
  mediaId: string | null;
  wanted: boolean;
  logged: boolean;
}

/** The want-to-watch list. */
export interface WantedRepository {
  list(): Promise<Result<WantedItem[]>>;
  /** Saves the title if it is new, then adds it to the list. Returns our id for it. */
  add(details: CatalogDetails): Promise<Result<string>>;
  remove(mediaId: string): Promise<Result<void>>;
  status(kind: CatalogKind, tmdbId: number): Promise<Result<TitleStatus>>;
  /** Items taken off the list by watching them, with when they were added and cleared. */
  cleared(): Promise<Result<ClearedItem[]>>;
}
