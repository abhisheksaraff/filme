// lib/ports/catalog.ts
import type { Result } from "./result";

export type CatalogKind = "Movie" | "TV Show";

/** What the catalogue knows about a title, in the app's own field names. */
export interface CatalogDetails {
  tmdbId: number;
  imdbId: string | null;
  category: CatalogKind;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  runtime: number | null;
  releaseYear: number | null;
  originalLanguage: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  genres: string[];
  directors: string[];
  producers: string[];
  cast: string[];
  posterPath: string | null;
  backdropPath: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

export interface CatalogMatch {
  tmdbId: number;
  kind: CatalogKind;
}

/** Looks films and shows up in an external catalogue (TMDB). */
export interface Catalog {
  /** Best match for a title, or null when nothing fits. */
  findClosest(title: string, category: string | null): Promise<Result<CatalogMatch | null>>;
  details(match: CatalogMatch): Promise<Result<CatalogDetails>>;
}
