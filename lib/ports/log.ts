// lib/ports/log.ts
import type { LogEntry } from "@/lib/domain/entry";
import type { SeatDetail } from "@/lib/domain/sessions";
import type { Result } from "./result";

/** A saved viewing as the watchlist shows it. */
export interface RecentEntry {
  id: string;
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
  watchedOn: string | null;
  primaryFormat: string | null;
}

/** One viewing on a title page, with signed links to its ticket stubs. */
export interface ViewingSummary {
  id: string;
  watchedOn: string | null;
  watchedAt: string | null;
  venue: string | null;
  auditorium: string | null;
  primaryFormat: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  rating: number | null;
  notes: string | null;
  stubUrls: string[];
}

/** A title and every time the user has seen it. */
export interface TitleDetail {
  mediaId: string;
  title: string;
  category: string;
  overview: string | null;
  releaseDate: string | null;
  runtime: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  viewings: ViewingSummary[];
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
  saveEntry(entry: LogEntry, stubs: Blob[]): Promise<Result<{ sessionId: string }>>;
  recent(limit: number): Promise<Result<RecentEntry[]>>;

  titleDetail(mediaId: string): Promise<Result<TitleDetail>>;
  /** One viewing as the edit form needs it. */
  getViewing(id: string): Promise<Result<{ mediaId: string; entry: LogEntry }>>;
  /** Changes a viewing's own details. The title it belongs to is not changed. */
  updateViewing(id: string, entry: LogEntry): Promise<Result<void>>;
  /** Hides a viewing; it can be restored for 30 days, after which the weekly cleanup removes it. */
  deleteViewing(id: string): Promise<Result<void>>;
  restoreViewing(id: string): Promise<Result<void>>;
  deleted(limit: number): Promise<Result<DeletedEntry[]>>;
}
