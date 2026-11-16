// lib/domain/search.ts
// Typo-tolerant search and filtering over the user's own viewings.
import type { LogFilter } from "./askLog";
import type { StatRow } from "./stats";

/** Lower case, accents removed, punctuation turned into spaces. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Edit distance between two short words, giving up early once it exceeds `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > limit) return limit + 1;
    previous = row;
  }
  return previous[b.length];
}

/** How many typos a word of this length may contain and still match. */
const allowance = (length: number) => (length <= 3 ? 0 : length <= 6 ? 1 : 2);

/** True when every word of the query matches some word of the text, allowing small typos and prefixes. */
export function fuzzyMatches(query: string, text: string): boolean {
  const words = normalize(text).split(" ");
  return normalize(query)
    .split(" ")
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q) || distance(q, w.slice(0, q.length + 1), allowance(q.length)) <= allowance(q.length)));
}

const haystack = (row: StatRow) =>
  [row.title, row.venue, row.notes, row.format, row.category, ...row.genres, ...row.directors, ...row.actors, ...row.performers].filter(Boolean).join(" ");

const sameFold = (a: string | null, b: string) => a !== null && normalize(a).includes(normalize(b));

/** Applies a filter to the viewings, sorted as the filter asks (newest first by default). */
export function applyFilter(rows: StatRow[], filter: LogFilter): StatRow[] {
  const found = rows.filter((row) => {
    if (filter.text && !fuzzyMatches(filter.text, haystack(row))) return false;
    if (filter.category && row.category !== filter.category) return false;
    if (filter.minRating !== null && (row.score ?? 0) < filter.minRating) return false;
    if (filter.maxRating !== null && (row.score === null || row.score > filter.maxRating)) return false;
    if (filter.format && !sameFold(row.format, filter.format)) return false;
    if (filter.extra && !row.addons.some((a) => sameFold(a, filter.extra as string))) return false;
    if (filter.venue && !sameFold(row.venue, filter.venue)) return false;
    if (filter.genre && !row.genres.some((g) => sameFold(g, filter.genre as string))) return false;
    if (filter.person && ![...row.directors, ...row.actors, ...row.performers].some((p) => fuzzyMatches(filter.person as string, p))) return false;
    if (filter.releaseFrom !== null && (row.releaseYear === null || row.releaseYear < filter.releaseFrom)) return false;
    if (filter.releaseTo !== null && (row.releaseYear === null || row.releaseYear > filter.releaseTo)) return false;
    if (filter.dateFrom && (!row.watchedOn || row.watchedOn < filter.dateFrom.slice(0, row.watchedOn.length))) return false;
    if (filter.dateTo && (!row.watchedOn || row.watchedOn > filter.dateTo)) return false;
    return true;
  });

  let result = found;
  if (filter.rewatchesOnly) {
    // A rewatch is any viewing of a title after its earliest one.
    const earliest = new Map<string, string>();
    for (const row of rows) {
      const date = row.watchedOn ?? "";
      const current = earliest.get(row.mediaId);
      if (current === undefined || date < current) earliest.set(row.mediaId, date);
    }
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.mediaId, (counts.get(row.mediaId) ?? 0) + 1);
    result = found.filter((row) => (counts.get(row.mediaId) ?? 0) > 1 && (row.watchedOn ?? "") !== earliest.get(row.mediaId));
  }

  const sorted = [...result];
  if (filter.sort === "rating") sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  else if (filter.sort === "oldest") sorted.sort((a, b) => (a.watchedOn ?? "").localeCompare(b.watchedOn ?? ""));
  else sorted.sort((a, b) => (b.watchedOn ?? "").localeCompare(a.watchedOn ?? ""));
  return sorted;
}

/** Short phrases describing a filter, shown as chips so the user can see how a question was understood. */
export function describeFilter(filter: LogFilter): string[] {
  return [
    filter.text && `“${filter.text}”`,
    filter.category,
    filter.genre,
    filter.person && `with ${filter.person}`,
    filter.venue && `at ${filter.venue}`,
    filter.format,
    filter.extra,
    filter.minRating !== null && `★ ${filter.minRating}+`,
    filter.maxRating !== null && `★ up to ${filter.maxRating}`,
    (filter.releaseFrom !== null || filter.releaseTo !== null) && (filter.releaseFrom === filter.releaseTo ? `${filter.releaseFrom}` : `${filter.releaseFrom ?? "…"}–${filter.releaseTo ?? "…"}`),
    filter.dateFrom && `from ${filter.dateFrom}`,
    filter.dateTo && `to ${filter.dateTo}`,
    filter.rewatchesOnly && "rewatches",
  ].filter((chip): chip is string => typeof chip === "string" && chip.length > 0);
}
