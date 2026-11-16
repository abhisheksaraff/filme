// lib/ports/log.ts
import type { LogEntry } from "@/lib/domain/entry";
import type { LastViewing } from "@/lib/domain/lastWatched";
import type { SeatDetail } from "@/lib/domain/sessions";
import type { StatRow } from "@/lib/domain/stats";
import type { CatalogMatch } from "./catalog";
import type { Result } from "./result";

/** A saved viewing as the watchlist shows it. */
export interface RecentEntry {
  id: string;
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
  watchedOn: string | null;
  watchedAt: string | null;
  primaryFormat: string | null;
  addons: string[];
  venueId: string | null;
  venue: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  rating: number | null;
  /** The title's TMDB id and release date, and its IMDb score (TMDB's when there is none); null for things added by hand. */
  tmdbId: number | null;
  releaseDate: string | null;
  score: number | null;
  notes: string | null;
  scope: "show" | "season" | "episode";
  season: number | null;
  episode: number | null;
}

/** One viewing on a title page, with signed links to its ticket stubs. */
export interface ViewingSummary {
  id: string;
  watchedOn: string | null;
  watchedAt: string | null;
  venue: string | null;
  venueId: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  auditorium: string | null;
  primaryFormat: string | null;
  addons: string[];
  seats: SeatDetail[];
  totalTickets: number | null;
  rating: number | null;
  notes: string | null;
  /** For shows: whether it covered the whole series, a season or one episode. */
  scope: "show" | "season" | "episode";
  season: number | null;
  episode: number | null;
  stubUrls: string[];
}

/** A title and every time the user has seen it. */
export interface TitleDetail {
  mediaId: string;
  tmdbId: number | null;
  title: string;
  category: string;
  overview: string | null;
  releaseDate: string | null;
  runtime: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  viewings: ViewingSummary[];
}

/** A title in the user's log that matches a search. */
export interface OwnHit {
  mediaId: string;
  title: string;
  category: string;
  year: string | null;
  posterPath: string | null;
  viewings: number;
}

/** A viewing in the undo window. */
export interface DeletedEntry {
  id: string;
  title: string;
  deletedAt: string;
}

/** Saves and lists the user's viewings. */
export interface LogRepository {
  /**
   * Saves one viewing with its title, venue and ticket images. If any part fails, the viewing is
   * removed again so nothing half-saved is left behind.
   */
  saveEntry(entry: LogEntry, stubs: Blob[]): Promise<Result<{ sessionId: string; mediaId: string; clearedWatchlist: boolean }>>;
  recent(limit: number): Promise<Result<RecentEntry[]>>;

  titleDetail(mediaId: string): Promise<Result<TitleDetail>>;
  /** One viewing as the edit form needs it. */
  getViewing(id: string): Promise<Result<{ mediaId: string; entry: LogEntry }>>;
  /** Changes a viewing's details, including its title or type; returns the title the viewing now belongs to. */
  updateViewing(id: string, entry: LogEntry): Promise<Result<{ mediaId: string }>>;
  /** Permanently removes viewings deleted more than 30 days ago, together with their stored images. */
  purgeExpired(): Promise<Result<number>>;
  /** Hides a viewing; it can be restored for 24 hours, after which the next cleanup removes it. */
  deleteViewing(id: string): Promise<Result<void>>;
  restoreViewing(id: string): Promise<Result<void>>;
  deleted(limit: number): Promise<Result<DeletedEntry[]>>;

  /** Logged titles whose name contains the text. */
  search(query: string, limit: number): Promise<Result<OwnHit[]>>;
  /** The best-rated titles the user has seen (recent ones when nothing is rated), for recommendations. */
  favourites(limit: number): Promise<Result<CatalogMatch[]>>;
  /** Every catalogue title already seen, as "Movie:123" keys, so browsing can skip them. */
  seen(): Promise<Result<string[]>>;
  /** The most recent dated viewing of a title, for the "Last watched" line; null when there is none. */
  lastViewing(mediaId: string): Promise<Result<LastViewing | null>>;
  /** One compact row per viewing, for statistics and stories. */
  statRows(): Promise<Result<StatRow[]>>;
}
