// lib/ports/catalog.ts
import type { Result } from "./result";

export type CatalogKind = "Movie" | "TV Show";

/** One person's credit on a title. */
export interface CatalogCredit {
  tmdbId: number;
  name: string;
  role: "actor" | "director" | "producer" | "writer" | "creator";
  character: string | null;
  order: number | null;
  profilePath: string | null;
}

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
  genreList: { id: number; name: string }[];
  credits: CatalogCredit[];
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
  releaseDate?: string | null;
  genreIds?: number[];
  language?: string | null;
}

/** A person from the catalogue with the titles they worked on, newest first. */
export interface CatalogPerson {
  name: string;
  biography: string | null;
  profileUrl: string | null;
  works: CatalogHit[];
}

/** A person found by name in the catalogue. */
export interface CatalogPersonHit {
  tmdbId: number;
  name: string;
  profilePath: string | null;
}

export interface EpisodeRef {
  season: number;
  episode: number;
}

/** How far a show has got: its seasons, and the latest and next episodes on air. */
export interface ShowStatus {
  seasons: { season: number; episodes: number }[];
  last: (EpisodeRef & { name: string | null; airDate: string | null }) | null;
  next: (EpisodeRef & { name: string | null; airDate: string | null }) | null;
}

export interface CatalogMatch {
  tmdbId: number;
  kind: CatalogKind;
}

/** A browse request: what to list from the catalogue when the user has typed nothing. */
export interface BrowseSpec {
  kind: CatalogKind;
  genreId?: number;
  /** Original language, as a two-letter code. */
  language?: string;
  sortBy: "popularity.desc" | "vote_average.desc";
  minVotes?: number;
  minRating?: number;
  page?: number;
}

/** Looks films and shows up in an external catalogue (TMDB). */
export interface Catalog {
  /** A few likely titles for what the user has typed so far. Only movies and shows exist on TMDB. */
  search(title: string, category: string): Promise<Result<CatalogHit[]>>;
  /** Best match for a title, or null when nothing fits. */
  findClosest(title: string, category: string | null): Promise<Result<CatalogMatch | null>>;
  /** Titles that fit a genre, language and quality filter. */
  browse(spec: BrowseSpec): Promise<Result<CatalogHit[]>>;
  /** Titles the catalogue suggests for people who liked this one. */
  recommendations(match: CatalogMatch): Promise<Result<CatalogHit[]>>;
  person(tmdbId: number): Promise<Result<CatalogPerson>>;
  /** A few people whose name fits what has been typed. */
  searchPeople(query: string): Promise<Result<CatalogPersonHit[]>>;
  /** Every episode of one season, or of the whole show when season is null. */
  episodes(tmdbId: number, season: number | null): Promise<Result<EpisodeRef[]>>;
  showStatus(tmdbId: number): Promise<Result<ShowStatus>>;
  /** Poster and cover paths available for a title. */
  images(match: CatalogMatch): Promise<Result<{ posters: string[]; backdrops: string[] }>>;
  /** Films in cinemas now, or opening soon, in a country. */
  theatres(when: "now" | "soon", region: string): Promise<Result<CatalogHit[]>>;
  details(match: CatalogMatch): Promise<Result<CatalogDetails>>;
}
