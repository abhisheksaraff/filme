// lib/domain/askLog.ts
// Filters that narrow the log, whether typed by hand or produced by the AI from a question.
import { z } from "zod";

/** One name or several: the AI (and a saved older filter) may give a single text or nothing at all. */
const names = z.preprocess((v) => (typeof v === "string" ? (v.trim() ? [v.trim()] : []) : Array.isArray(v) ? v : []), z.array(z.string()));

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
  /** Formats, extras (such as IMAX or D-BOX) and venues; a title matches when it has any of them. */
  format: names,
  extra: names,
  venue: names,
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
  format: [],
  extra: [],
  venue: [],
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

/** A filter's venues, formats or extras as a list, whatever shape an older saved filter had. */
export function asList(value: unknown): string[] {
  return typeof value === "string" ? (value ? [value] : []) : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function hasFilter(filter: LogFilter): boolean {
  return Object.entries(filter).some(([key, value]) => (key === "rewatchesOnly" ? value === true : key === "format" || key === "extra" || key === "venue" ? asList(value).length > 0 : value !== null && key !== "sort"));
}
