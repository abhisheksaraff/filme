// components/entryDraft.ts
// The entry form's working copy: every field is a string, because that is what inputs hold.
import { logEntrySchema, type EntryMedia, type LogEntry } from "@/lib/domain/entry";
import type { ExtractedData } from "@/lib/domain/extraction";
import type { FormatAddon, PrimaryFormat } from "@/lib/domain/formats";
import type { MediaCategory } from "@/lib/domain/media";
import type { CatalogDetails } from "@/lib/ports/catalog";
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
