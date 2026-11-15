// lib/domain/askLog.ts
// Filters that narrow the log, whether typed by hand or produced by the AI from a question.
import { z } from "zod";

export const logFilterSchema = z.object({
  text: z.string().nullable(),
  category: z.enum(["Movie", "TV Show", "Concert", "Live Event"]).nullable(),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  /** Release years (not the dates watched), such as 1950 to 1959 for "the 50s". */
  releaseFrom: z.number().int().min(1870).max(2200).nullable(),
  releaseTo: z.number().int().min(1870).max(2200).nullable(),
  minRating: z.number().min(0).max(10).nullable(),
  maxRating: z.number().min(0).max(10).nullable(),
  format: z.string().nullable(),
  /** A format extra such as IMAX or D-BOX. */
  extra: z.string().nullable(),
  venue: z.string().nullable(),
  genre: z.string().nullable(),
  person: z.string().nullable(),
  rewatchesOnly: z.boolean(),
  sort: z.enum(["newest", "oldest", "rating"]).nullable(),
});
export type LogFilter = z.infer<typeof logFilterSchema>;

export const EMPTY_FILTER: LogFilter = {
  text: null,
  category: null,
  dateFrom: null,
  dateTo: null,
  releaseFrom: null,
  releaseTo: null,
  minRating: null,
  maxRating: null,
  format: null,
  extra: null,
  venue: null,
  genre: null,
  person: null,
  rewatchesOnly: false,
  sort: null,
};

/** Cleans the AI's reply into a filter, falling back to "no filter" for anything unexpected. */
export function normalizeFilter(value: unknown): LogFilter {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const parsed = logFilterSchema.safeParse({ ...EMPTY_FILTER, ...raw, rewatchesOnly: raw.rewatchesOnly === true });
  return parsed.success ? parsed.data : EMPTY_FILTER;
}

export function hasFilter(filter: LogFilter): boolean {
  return Object.entries(filter).some(([key, value]) => (key === "rewatchesOnly" ? value === true : value !== null && key !== "sort"));
}
