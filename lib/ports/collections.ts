// lib/ports/collections.ts
import type { CatalogDetails } from "./catalog";
import type { Result } from "./result";

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  count: number;
  /** Up to three posters for a thumbnail. */
  posterPaths: string[];
}

export interface CollectionItem {
  mediaId: string;
  tmdbId: number | null;
  category: string;
  title: string;
  year: string | null;
  posterPath: string | null;
}

export interface CollectionDetail {
  id: string;
  name: string;
  description: string | null;
  items: CollectionItem[];
}

/** The user's hand-made lists of titles. */
export interface CollectionRepository {
  list(): Promise<Result<CollectionSummary[]>>;
  create(name: string, description: string | null): Promise<Result<string>>;
  update(id: string, name: string, description: string | null): Promise<Result<void>>;
  /** Deletes the collection only; its titles stay wherever else they are saved. */
  remove(id: string): Promise<Result<void>>;
  get(id: string): Promise<Result<CollectionDetail>>;
  addMedia(id: string, mediaId: string): Promise<Result<void>>;
  /** Saves a catalogue title if it is new, then adds it. */
  addCatalog(id: string, details: CatalogDetails): Promise<Result<void>>;
  removeMedia(id: string, mediaId: string): Promise<Result<void>>;
}
