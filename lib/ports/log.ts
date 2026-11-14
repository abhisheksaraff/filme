// lib/ports/log.ts
import type { LogEntry } from "@/lib/domain/entry";
import type { Result } from "./result";

/** A saved viewing as the watchlist shows it. */
export interface RecentEntry {
  id: string;
  title: string;
  category: string;
  posterPath: string | null;
  watchedOn: string | null;
  primaryFormat: string | null;
}

/** Saves and lists the user's viewings. */
export interface LogRepository {
  /**
   * Saves one viewing with its title, venue and ticket images. If any part fails, the viewing is
   * removed again so nothing half-saved is left behind.
   */
  saveEntry(entry: LogEntry, stubs: Blob[]): Promise<Result<{ sessionId: string }>>;
  recent(limit: number): Promise<Result<RecentEntry[]>>;
}
