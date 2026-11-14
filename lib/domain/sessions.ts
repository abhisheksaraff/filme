// lib/domain/sessions.ts
import { z } from "zod";
import { FORMAT_ADDONS, PRIMARY_FORMATS } from "./formats";
import { datePrecisionSchema, idSchema, ratingSchema, timestampSchema } from "./primitives";

export const primaryFormatSchema = z.enum(PRIMARY_FORMATS);
export const formatAddonSchema = z.enum(FORMAT_ADDONS);

export const seatDetailSchema = z.object({
  section: z.string().nullable().optional(),
  row: z.string().nullable().optional(),
  seat: z.string().nullable().optional(),
});
export type SeatDetail = z.infer<typeof seatDetailSchema>;

/** What a viewing covers: a whole show, one season, or one episode. */
export const sessionScopeSchema = z.enum(["show", "season", "episode"]);

export const sessionStatusSchema = z.enum(["watched", "in_progress", "dropped"]);

/** One viewing of a title. Rewatches are separate rows, not a counter. */
export const watchSessionSchema = z.object({
  id: idSchema,
  mediaId: idSchema,
  venueId: idSchema.nullable(),
  scope: sessionScopeSchema,
  seasonNumber: z.number().int().nullable(),
  episodeNumber: z.number().int().nullable(),
  watchedOn: z.string().nullable(),
  datePrecision: datePrecisionSchema,
  watchedAt: z.string().nullable(),
  status: sessionStatusSchema,
  rating: ratingSchema.nullable(),
  notes: z.string().nullable(),
  primaryFormat: primaryFormatSchema.nullable(),
  addons: z.array(formatAddonSchema),
  auditorium: z.string().nullable(),
  seats: z.array(seatDetailSchema),
  totalTickets: z.number().int().min(0).nullable(),
  /** Groups sessions created together, such as a season logged in one go. */
  batchId: idSchema.nullable(),
  deletedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type WatchSession = z.infer<typeof watchSessionSchema>;
