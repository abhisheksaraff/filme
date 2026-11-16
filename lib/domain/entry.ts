// lib/domain/entry.ts
// What the user confirms before a viewing is saved: the ticket fields plus the matched title.
import { z } from "zod";
import { formatAddonSchema, primaryFormatSchema, seatDetailSchema } from "./sessions";
import { mediaCategorySchema } from "./media";
import { dateSchema, ratingSchema } from "./primitives";
import { VENUE_TYPES } from "./venueTypes";

/** The title as TMDB describes it, kept so the catalogue row can be created or reused. */
export const entryMediaSchema = z.object({
  tmdbId: z.number().int(),
  imdbId: z.string().nullable(),
  title: z.string().min(1),
  originalTitle: z.string().nullable(),
  originalLanguage: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtime: z.number().int().nullable(),
  overview: z.string().nullable(),
  voteAverage: z.number().nullable(),
  voteCount: z.number().int().nullable(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
});
export type EntryMedia = z.infer<typeof entryMediaSchema>;

const venueTypeSchema = z.enum(VENUE_TYPES.map((t) => t.id) as [string, ...string[]]);

export const logEntrySchema = z.object({
  category: mediaCategorySchema,
  title: z.string().trim().min(1),
  season: z.number().int().min(0).nullable(),
  episode: z.number().int().min(0).nullable(),
  episodeTitle: z.string().nullable(),
  location: z.string().nullable(),
  address: z.string().nullable(),
  /** The kind of place, when chosen; otherwise it follows the venue, or the kind of thing logged. */
  venueType: venueTypeSchema.nullable().optional(),
  auditorium: z.string().nullable(),
  date: dateSchema.nullable(),
  time: z.string().nullable(),
  seats: z.array(seatDetailSchema),
  totalTickets: z.number().int().min(0).nullable(),
  primaryFormat: primaryFormatSchema.nullable(),
  addons: z.array(formatAddonSchema),
  rating: ratingSchema.nullable(),
  notes: z.string().nullable(),
  /** For shows: how many episodes, seasons and minutes the viewing covers, worked out when it is saved. */
  episodesCovered: z.number().int().min(0).nullable().optional(),
  seasonsCovered: z.number().int().min(0).nullable().optional(),
  minutes: z.number().int().min(0).nullable().optional(),
  /** Null for titles TMDB does not have; they are saved as custom items. */
  media: entryMediaSchema.nullable(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
