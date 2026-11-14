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

/** One search result: enough to show a pick-list and to fetch the full details. */
export interface CatalogHit extends CatalogMatch {
  title: string;
  year: string | null;
  posterUrl: string | null;
}

export interface CatalogMatch {
  tmdbId: number;
  kind: CatalogKind;
}

/** Looks films and shows up in an external catalogue (TMDB). */
export interface Catalog {
  /** A few likely titles for what the user has typed so far. Only movies and shows exist on TMDB. */
  search(title: string, category: string): Promise<Result<CatalogHit[]>>;
  /** Best match for a title, or null when nothing fits. */
  findClosest(title: string, category: string | null): Promise<Result<CatalogMatch | null>>;
  details(match: CatalogMatch): Promise<Result<CatalogDetails>>;
}
