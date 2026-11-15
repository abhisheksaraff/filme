// components/entryDraft.ts
// The entry form's working copy: every field is a string, because that is what inputs hold.
import { logEntrySchema, type EntryMedia, type LogEntry } from "@/lib/domain/entry";
import type { ExtractedData } from "@/lib/domain/extraction";
import type { FormatAddon, PrimaryFormat } from "@/lib/domain/formats";
import type { MediaCategory } from "@/lib/domain/media";
import type { CatalogDetails } from "@/lib/ports/catalog";
import type { PeopleChange, PersonRole, StarringPick } from "@/lib/adapters/supabase/credits";
import { fail, ok, type Result } from "@/lib/ports/result";

export interface DraftSeat {
  section: string;
  row: string;
  seat: string;
}

export interface EntryDraft {
  category: MediaCategory;
  title: string;
  season: string;
  episode: string;
  episodeTitle: string;
  location: string;
  address: string;
  auditorium: string;
  date: string;
  time: string;
  totalTickets: string;
  primaryFormat: PrimaryFormat;
  addons: FormatAddon[];
  seats: DraftSeat[];
  rating: string;
  notes: string;
  /** Cast and crew rows; saved with the title, not with this one viewing. */
  people: PeopleDraft;
}

export const PERSON_ROLES: readonly PersonRole[] = ["actor", "director", "producer", "writer", "creator"];
export type PeopleDraft = Record<PersonRole, StarringPick[]>;
export const emptyPeople = (): PeopleDraft => ({ actor: [], director: [], producer: [], writer: [], creator: [] });

export const ROLE_LABEL: Record<PersonRole, string> = { actor: "Starring", director: "Director", producer: "Producer", writer: "Writer", creator: "Creator" };

/** The rows shown for a kind of title; concerts and live events list performers elsewhere. */
export function rolesFor(category: string): PersonRole[] {
  if (category === "Movie") return ["actor", "director", "producer", "writer"];
  if (category === "TV Show") return ["actor", "director", "producer", "writer", "creator"];
  return [];
}

/** True when two picks are the same person: same row, same catalogue id, or the same typed name. */
export const samePick = (a: StarringPick, b: StarringPick) =>
  (!!a.personId && a.personId === b.personId) ||
  (a.tmdbId !== null && a.tmdbId === b.tmdbId) ||
  (!a.personId && a.tmdbId === null && !b.personId && b.tmdbId === null && a.name.toLowerCase() === b.name.toLowerCase());

/** Fills every row from a matched title, keeping anyone the user added by hand and replacing the previous match. */
export function peopleFromMatch(current: PeopleDraft, details: CatalogDetails): PeopleDraft {
  const next = emptyPeople();
  for (const role of PERSON_ROLES) {
    const fromMatch = [...new Map(details.credits.filter((c) => c.role === role).map((c) => [c.tmdbId, c])).values()]
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map((c): StarringPick => ({ personId: null, tmdbId: c.tmdbId, name: c.name, profilePath: c.profilePath, order: c.order, character: c.character, fromMatch: true }));
    const manual = current[role].filter((p) => !p.fromMatch && !fromMatch.some((m) => samePick(m, p)));
    next[role] = [...fromMatch, ...manual];
  }
  return next;
}

/** Drops everyone a match filled in, when the user changes the title and the match no longer applies. */
export function withoutMatchPeople(current: PeopleDraft): PeopleDraft {
  const next = emptyPeople();
  for (const role of PERSON_ROLES) next[role] = current[role].filter((p) => !p.fromMatch);
  return next;
}

/**
 * What to save for a new viewing: people added by hand are linked, and catalogue people the user
 * took out of a row are removed (the catalogue fill itself is saved by the usual credits refresh).
 */
export function changesFromMatch(people: PeopleDraft, details: CatalogDetails | null, category: string): { added: PeopleChange[]; removed: PeopleChange[] } {
  const roles = rolesFor(category);
  const added = roles.flatMap((role) => people[role].filter((p) => !p.fromMatch).map((pick) => ({ role, pick })));
  const removed = details
    ? details.credits
        .filter((c) => roles.includes(c.role) && !people[c.role].some((p) => p.tmdbId === c.tmdbId))
        .map((c) => ({ role: c.role, pick: { personId: null, tmdbId: c.tmdbId, name: c.name, profilePath: c.profilePath } }))
    : [];
  return { added, removed };
}

/** What changed in the rows of a saved title, compared with what was loaded. */
export function changesFromEdit(before: PeopleDraft, after: PeopleDraft, category: string): { added: PeopleChange[]; removed: PeopleChange[] } {
  const roles = rolesFor(category);
  return {
    added: roles.flatMap((role) => after[role].filter((p) => !before[role].some((b) => samePick(b, p))).map((pick) => ({ role, pick }))),
    removed: roles.flatMap((role) => before[role].filter((b) => !after[role].some((p) => samePick(b, p))).map((pick) => ({ role, pick }))),
  };
}

export const EMPTY_DRAFT: EntryDraft = {
  category: "Movie",
  title: "",
  season: "",
  episode: "",
  episodeTitle: "",
  location: "",
  address: "",
  auditorium: "",
  date: "",
  time: "",
  totalTickets: "1",
  primaryFormat: "Standard",
  addons: [],
  seats: [],
  rating: "",
  notes: "",
  people: emptyPeople(),
};

const text = (value: string | null | undefined) => value ?? "";
const numberText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

/** Fills the form from what the AI read; the date input only accepts a full YYYY-MM-DD. */
export function draftFromExtraction(data: ExtractedData): EntryDraft {
  return {
    ...EMPTY_DRAFT,
    category: data.category ?? "Movie",
    title: text(data.title),
    season: numberText(data.season),
    episode: numberText(data.episode),
    episodeTitle: text(data.episodeTitle),
    location: text(data.location),
    address: text(data.address),
    auditorium: text(data.auditorium),
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date ?? "") ? (data.date as string) : "",
    time: text(data.time),
    totalTickets: String(data.totalTickets),
    primaryFormat: data.primaryFormat,
    addons: data.addons,
    seats: data.seats.map((s) => ({ section: text(s.section), row: text(s.row), seat: text(s.seat) })),
  };
}

export function mediaFromCatalog(details: CatalogDetails): EntryMedia {
  return {
    tmdbId: details.tmdbId,
    imdbId: details.imdbId,
    title: details.title,
    originalTitle: details.originalTitle,
    originalLanguage: details.originalLanguage,
    releaseDate: details.releaseDate,
    runtime: details.runtime,
    overview: details.overview,
    voteAverage: details.voteAverage,
    voteCount: details.voteCount,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
  };
}

/** Turns the form into a validated entry, or a short message about what to fix. */
export function entryFromDraft(draft: EntryDraft, media: EntryMedia | null): Result<LogEntry> {
  if (!draft.title.trim()) return fail("Enter a title.");

  const orNull = (value: string) => value.trim() || null;
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));
  const isShow = draft.category === "TV Show";

  const parsed = logEntrySchema.safeParse({
    category: draft.category,
    title: draft.title,
    season: isShow ? toNumber(draft.season) : null,
    episode: isShow ? toNumber(draft.episode) : null,
    episodeTitle: isShow ? orNull(draft.episodeTitle) : null,
    location: orNull(draft.location),
    address: orNull(draft.address),
    auditorium: orNull(draft.auditorium),
    date: orNull(draft.date),
    time: orNull(draft.time),
    seats: draft.seats
      .map((s) => ({ section: orNull(s.section), row: orNull(s.row), seat: orNull(s.seat) }))
      .filter((s) => s.section || s.row || s.seat),
    totalTickets: toNumber(draft.totalTickets),
    primaryFormat: draft.primaryFormat,
    addons: draft.addons,
    rating: toNumber(draft.rating),
    notes: orNull(draft.notes),
    media,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`Check "${issue.path.join(" ")}": ${issue.message}`);
  }
  return ok(parsed.data);
}

/** The short text shown on a seat bubble, such as "F-12" or "102-F-12". */
export function seatLabel(seat: { section?: string | null; row?: string | null; seat?: string | null }): string {
  return [seat.section, seat.row, seat.seat].filter(Boolean).join("-");
}

/**
 * Turns typed seat text into a seat. "F12" and "F-12" mean row F, seat 12; three parts such as
 * "102-F-12" mean section, row, seat; anything else is kept whole as the seat.
 */
export function parseSeatTag(raw: string): DraftSeat | null {
  const text = raw.trim();
  if (!text) return null;

  const rowAndSeat = /^([A-Za-z]{1,3})\s*[-/ ]?\s*(\d{1,4}[A-Za-z]?)$/.exec(text);
  if (rowAndSeat) return { section: "", row: rowAndSeat[1].toUpperCase(), seat: rowAndSeat[2] };

  const parts = text.split(/[\s\-/]+/).filter(Boolean);
  if (parts.length === 3) return { section: parts[0], row: parts[1], seat: parts[2] };
  if (parts.length === 2) return { section: "", row: parts[0], seat: parts[1] };
  return { section: "", row: "", seat: text };
}

/** Fills the edit form from a saved viewing. */
export function draftFromEntry(entry: LogEntry): EntryDraft {
  return {
    category: entry.category,
    title: entry.title,
    season: numberText(entry.season),
    episode: numberText(entry.episode),
    episodeTitle: text(entry.episodeTitle),
    location: text(entry.location),
    address: text(entry.address),
    auditorium: text(entry.auditorium),
    date: /^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry.date ?? "") ? (entry.date as string) : "",
    time: text(entry.time),
    totalTickets: numberText(entry.totalTickets),
    primaryFormat: entry.primaryFormat,
    addons: entry.addons,
    seats: entry.seats.map((s) => ({ section: text(s.section), row: text(s.row), seat: text(s.seat) })),
    rating: numberText(entry.rating),
    notes: text(entry.notes),
    people: emptyPeople(),
  };
}
