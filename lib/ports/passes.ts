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

/** What passes belong to: a show (its id) or a movie collection. */
export type Subject = string | { collectionId: number };

/** A stored completion card: a season, a series or a movie collection finished. */
export interface Completion {
  id: string;
  mediaId: string | null;
  collectionId: number | null;
  collectionName: string | null;
  season: number | null;
  passKey: string;
  lastViewingId: string | null;
  completedOn: string | null;
  /** True once the card has pictures of its own; until then it shows the last viewing's. */
  ownPictures: boolean;
}

/** What the daily and after-every-change check works out for one card. */
export interface CompletionDraft {
  season: number | null;
  passKey: string;
  lastViewingId: string;
  completedOn: string | null;
}

/** Rewatch resets, edits to completion cards, and the stored cards themselves. */
export interface PassRepository {
  resets(subject: Subject): Promise<Result<Reset[]>>;
  /** Empties the rewatch in progress for a season (or the series when null); the viewings stay. */
  reset(subject: Subject, season: number | null): Promise<Result<void>>;
  edits(subject: Subject): Promise<Result<StackEdit[]>>;
  saveEdit(subject: Subject, season: number | null, passKey: string, fields: StackFields): Promise<Result<void>>;
  clearEdit(subject: Subject, season: number | null, passKey: string): Promise<Result<void>>;
  /** Every hand edit to any card, with whose it is. */
  allEdits(): Promise<Result<(StackEdit & { mediaId: string | null; collectionId: number | null })[]>>;
  /** Every active card, newest first. */
  completions(): Promise<Result<Completion[]>>;
  /** Makes the stored cards of a show or collection match `cards`: adds new ones, updates moved ones, hides the rest. */
  syncCompletions(subject: Subject, collectionName: string | null, cards: CompletionDraft[]): Promise<Result<void>>;
  completion(subject: Subject, season: number | null, passKey: string): Promise<Result<Completion | null>>;
  /** The collections the user has watched at least one film of. */
  collectionsSeen(): Promise<Result<{ collectionId: number; name: string | null }[]>>;
  /** Every show with at least one viewing. */
  showsSeen(): Promise<Result<string[]>>;
  /** Takes a collection off Continue watching; it returns when a viewing is added after `latestAddedAt`. */
  hideCollection(collectionId: number, latestAddedAt: string): Promise<Result<void>>;
  /** When each collection was taken off Home. */
  hiddenCollections(): Promise<Result<Map<number, string>>>;
  /** Keeps a collection out of Home's recommendations and Continue watching (or lets it back in). */
  setCollectionHidden(collectionId: number, hidden: boolean): Promise<Result<void>>;
  hiddenCollectionIds(): Promise<Result<Set<number>>>;
  /** Movies whose collection has not been looked up yet, to fill in for films logged before collections existed. */
  uncheckedMovies(limit: number): Promise<Result<{ mediaId: string; tmdbId: number }[]>>;
  /** A film's collection id: null when it has none, undefined when it was never looked up. */
  collectionOfMedia(mediaId: string): Promise<Result<number | null | undefined>>;
  setCollection(mediaId: string, collection: { id: number; name: string } | null): Promise<Result<void>>;
  /** Gives a card its own copy of the last viewing's pictures, so changes to either no longer touch the other. */
  adoptPictures(completionId: string, fromSessionId: string): Promise<Result<void>>;
}
