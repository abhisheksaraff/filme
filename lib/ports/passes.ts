// lib/ports/passes.ts
import type { LogEntry } from "@/lib/domain/entry";
import type { Reset } from "@/lib/domain/passes";
import type { Result } from "./result";

/** What a hand-edited completion card overrides; anything left out mirrors the last episode. */
export type StackFields = Partial<Pick<LogEntry, "location" | "address" | "venueType" | "auditorium" | "date" | "time" | "seats" | "totalTickets" | "primaryFormat" | "addons" | "rating" | "notes">> & {
  /** The venue the location resolved to, so the card can show its map. */
  venueId?: string | null;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
};

export interface StackEdit {
  /** Null for a series card. */
  season: number | null;
  passKey: string;
  fields: StackFields;
}

/** Rewatch resets and edits to completion cards. */
export interface PassRepository {
  resets(mediaId: string): Promise<Result<Reset[]>>;
  /** Empties the rewatch in progress for a season (or the series when null); the viewings stay. */
  reset(mediaId: string, season: number | null): Promise<Result<void>>;
  edits(mediaId: string): Promise<Result<StackEdit[]>>;
  saveEdit(mediaId: string, season: number | null, passKey: string, fields: StackFields): Promise<Result<void>>;
  clearEdit(mediaId: string, season: number | null, passKey: string): Promise<Result<void>>;
}
