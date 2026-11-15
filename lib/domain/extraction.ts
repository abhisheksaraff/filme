// lib/domain/extraction.ts
// What the AI reads off a ticket, and the cleaning that turns its reply into trustworthy data.
import { z } from "zod";
import { FORMAT_ADDONS, PRIMARY_FORMATS, type FormatAddon, type PrimaryFormat } from "./formats";

const CATEGORIES = ["Movie", "TV Show", "Concert", "Live Event"] as const;

const seatSchema = z.object({
  section: z.string().nullable().default(null),
  row: z.string().nullable().default(null),
  seat: z.string().nullable().default(null),
});

export const extractedDataSchema = z.object({
  category: z.enum(CATEGORIES).nullable(),
  title: z.string().nullable(),
  season: z.number().int().nullable(),
  episode: z.number().int().nullable(),
  episodeTitle: z.string().nullable(),
  location: z.string().nullable(),
  address: z.string().nullable(),
  auditorium: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  seats: z.array(seatSchema),
  totalTickets: z.number().int(),
  primaryFormat: z.enum(PRIMARY_FORMATS).nullable(),
  addons: z.array(z.enum(FORMAT_ADDONS)),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

export const DEFAULT_EXTRACTED_DATA: ExtractedData = {
  category: null,
  title: null,
  season: null,
  episode: null,
  episodeTitle: null,
  location: null,
  address: null,
  auditorium: null,
  date: null,
  time: null,
  seats: [],
  totalTickets: 1,
  primaryFormat: null,
  addons: [],
};

const NULL_WORDS = new Set(["unknown", "n/a", "none", "null", "tbd", "not found"]);

/** Models often answer "Unknown" or "N/A" instead of null; treat those as missing. */
function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || NULL_WORDS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function cleanInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * Turns an untrusted AI reply into a valid ExtractedData. Anything missing or malformed falls
 * back to a safe default instead of failing, so one odd field never loses the whole scan.
 */
export function normalizeExtraction(raw: unknown): ExtractedData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const categoryText = cleanText(obj.category)?.toLowerCase();
  const category = CATEGORIES.find((c) => c.toLowerCase() === categoryText) ?? null;

  const seats = (Array.isArray(obj.seats) ? obj.seats : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ section: cleanText(s.section), row: cleanText(s.row), seat: cleanText(s.seat) }));

  const formatText = cleanText(obj.primaryFormat);
  const primaryFormat = (PRIMARY_FORMATS as readonly string[]).includes(formatText ?? "")
    ? (formatText as PrimaryFormat)
    : null;

  const addons = (Array.isArray(obj.addons) ? obj.addons : []).filter(
    (a): a is FormatAddon => typeof a === "string" && (FORMAT_ADDONS as readonly string[]).includes(a),
  );

  return {
    category,
    title: cleanText(obj.title),
    season: cleanInt(obj.season),
    episode: cleanInt(obj.episode),
    episodeTitle: cleanText(obj.episodeTitle),
    location: cleanText(obj.location),
    address: cleanText(obj.address),
    auditorium: cleanText(obj.auditorium),
    date: cleanText(obj.date),
    time: cleanText(obj.time),
    seats,
    totalTickets: Math.max(1, cleanInt(obj.totalTickets) ?? (seats.length || 1)),
    primaryFormat,
    addons,
  };
}
