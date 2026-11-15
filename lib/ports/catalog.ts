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
  voteAverage?: number | null;
}

/** A person from the catalogue with the titles they are best known for, most popular first. */
export interface CatalogPerson {
  name: string;
  biography: string | null;
  /** null when the catalogue has no IMDb page for them. */
  imdbId: string | null;
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

/** One episode with what the episode page shows. */
export interface EpisodeDetail extends EpisodeRef {
  name: string | null;
  overview: string | null;
  /** YYYY-MM-DD; null while unannounced. */
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
}

/** Someone on an episode's cast or crew, under the heading they belong to. */
export interface EpisodePerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  /** "Cast", "Guest stars", "Director" or "Writer". */
  group: string;
  /** The character they play, for cast. */
  note: string | null;
}

/** One season and all its episodes. */
export interface SeasonDetail {
  season: number;
  name: string | null;
  overview: string | null;
  airDate: string | null;
  posterPath: string | null;
  episodes: EpisodeDetail[];
}

/** How far a show has got: its seasons, and the latest and next episodes on air. */
export interface ShowStatus {
  /** TMDB's own word for it, such as "Returning Series" or "Ended". */
  status: string | null;
  /** False once the show has ended or been cancelled. */
  running: boolean;
  seasons: { season: number; episodes: number; name: string | null; posterPath: string | null }[];
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
  sortBy: "popularity.desc" | "vote_average.desc" | "primary_release_date.desc" | "primary_release_date.asc";
  minVotes?: number;
  minRating?: number;
  /** Release years, inclusive. */
  yearFrom?: number;
  yearTo?: number;
  /** A person who worked on the title (movies only; TMDB cannot filter shows this way). */
  personId?: number;
  /** Actors who must all be in the film (movies only). */
  castAll?: number[];
  /** Actors of whom any one will do (movies only). */
  castAny?: number[];
  /** Directors or writers (movies only). */
  crewAny?: number[];
  /** TMDB keyword ids (themes, moods); any one will do. */
  keywordIds?: number[];
  /** Country of origin, two letters. */
  country?: string;
  /** Runtime limits in minutes (movies only). */
  maxRuntime?: number;
  minRuntime?: number;
  /** TMDB streaming provider ids, offered by subscription in the given region. */
  providerIds?: number[];
  region?: string;
  page?: number;
}

/** Looks films and shows up in an external catalogue (TMDB). */
export interface Catalog {
  /** A few likely titles for what the user has typed so far. Only movies and shows exist on TMDB. */
  search(title: string, category: string, limit?: number): Promise<Result<CatalogHit[]>>;
  /** Best match for a title, or null when nothing fits. */
  findClosest(title: string, category: string | null): Promise<Result<CatalogMatch | null>>;
  /** Titles that fit a genre, language and quality filter. */
  browse(spec: BrowseSpec): Promise<Result<CatalogHit[]>>;
  /** Titles the catalogue suggests for people who liked this one. */
  recommendations(match: CatalogMatch): Promise<Result<CatalogHit[]>>;
  person(tmdbId: number): Promise<Result<CatalogPerson>>;
  /** Every movie and show a person is credited on, best known first, for the "See all" list. */
  personCredits(tmdbId: number): Promise<Result<CatalogHit[]>>;
  /** The people credited most often alongside this person, from their best-known titles. */
  relatedPeople(tmdbId: number): Promise<Result<CatalogPersonHit[]>>;
  /** The best-matching TMDB keyword for a theme or mood, or null. */
  findKeyword(name: string): Promise<Result<number | null>>;
  /** A few people whose name fits what has been typed. */
  searchPeople(query: string): Promise<Result<CatalogPersonHit[]>>;
  /** Every episode of one season, or of the whole show when season is null. */
  episodes(tmdbId: number, season: number | null): Promise<Result<EpisodeRef[]>>;
  showStatus(tmdbId: number): Promise<Result<ShowStatus>>;
  /** A season's episodes with names, stills, runtimes and air dates. Kept for the rest of the session. */
  season(tmdbId: number, season: number): Promise<Result<SeasonDetail>>;
  /** The cast, guest stars, directors and writers of one episode. */
  episodePeople(tmdbId: number, season: number, episode: number): Promise<Result<EpisodePerson[]>>;
  /** Poster and cover paths available for a title. */
  images(match: CatalogMatch): Promise<Result<{ posters: string[]; backdrops: string[] }>>;
  /** Films in cinemas now, or opening soon, in a country. */
  theatres(when: "now" | "soon", region: string): Promise<Result<CatalogHit[]>>;
  details(match: CatalogMatch): Promise<Result<CatalogDetails>>;
}
