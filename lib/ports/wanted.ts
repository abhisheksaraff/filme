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
  /** When the title came out (a full date or just a year), if known. */
  releaseDate: string | null;
  /** Set when only a season (or one episode of it) is saved; both null means the whole title. */
  season: number | null;
  episode: number | null;
}

/** Which part of a show a Watchlist row is about; leaving it out means the whole title. */
export interface WantScope {
  season: number | null;
  episode: number | null;
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
  add(details: CatalogDetails, scope?: WantScope): Promise<Result<string>>;
  remove(mediaId: string, scope?: WantScope): Promise<Result<void>>;
  /** `wanted` is about the given part of a show (the whole title when left out). */
  status(kind: CatalogKind, tmdbId: number, scope?: WantScope): Promise<Result<TitleStatus>>;
  /** Items taken off the list by watching them, with when they were added and cleared. */
  cleared(): Promise<Result<ClearedItem[]>>;
}
