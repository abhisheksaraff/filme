// lib/domain/stats.ts
// Counts and totals over the user's viewings.

/** The facts about one viewing that statistics, stories, the calendar and search need. */
export interface StatRow {
  /** The viewing's own id. */
  id: string;
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
  /** YYYY, YYYY-MM or YYYY-MM-DD. */
  watchedOn: string | null;
  runtime: number | null;
  /** The year the title came out. */
  releaseYear: number | null;
  venue: string | null;
  format: string | null;
  rating: number | null;
  tickets: number | null;
  language: string | null;
  notes: string | null;
  /** "show", "season" or "episode"; season and episode say which. */
  scope: string;
  season: number | null;
  episode: number | null;
  genres: string[];
  directors: string[];
  actors: string[];
  performers: string[];
}

export interface Count {
  label: string;
  value: number;
}

export interface Stats {
  viewings: number;
  titles: number;
  /** Viewings of a title beyond the first. */
  rewatches: number;
  minutes: number;
  tickets: number;
  uniqueVenues: number;
  averageRating: number | null;
  /** January to December, for the rows given. */
  months: Count[];
  years: Count[];
  weekdays: Count[];
  ratings: Count[];
  topTitles: Count[];
  venues: Count[];
  formats: Count[];
  /** Average rating per format, best first (value is the average ×10, shown as x.x). */
  formatRatings: Count[];
  categories: Count[];
  languages: Count[];
  genres: Count[];
  directors: Count[];
  actors: Count[];
  performers: Count[];
  /** Actors by average rating, for those in at least two rated viewings. */
  bestActors: Count[];
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Counts repeated values, most common first, then A to Z. */
function tally(values: (string | null)[], limit = 8): Count[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Average rating per label, keeping labels with at least `minCount` ratings, best first. */
function averages(pairs: [string | null, number][], minCount: number, limit = 8): Count[] {
  const groups = new Map<string, number[]>();
  for (const [label, rating] of pairs) {
    if (!label) continue;
    groups.set(label, [...(groups.get(label) ?? []), rating]);
  }
  return [...groups.entries()]
    .filter(([, ratings]) => ratings.length >= minCount)
    .map(([label, ratings]) => ({ label, value: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** The years that appear in the log, newest first. */
export function statYears(rows: StatRow[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    const year = Number(row.watchedOn?.slice(0, 4));
    if (Number.isInteger(year) && year > 0) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** Keeps rows whose date falls in an inclusive range of YYYY-MM-DD strings (either end may be open). */
export function inRange(rows: StatRow[], from: string | null, to: string | null): StatRow[] {
  if (!from && !to) return rows;
  return rows.filter((row) => {
    if (!row.watchedOn) return false;
    // Short dates (YYYY or YYYY-MM) compare by their start so they land in the right period.
    const date = row.watchedOn.length === 10 ? row.watchedOn : `${row.watchedOn}${"-01-01".slice(row.watchedOn.length - 4)}`;
    return (!from || date >= from) && (!to || date <= to);
  });
}

export function computeStats(all: StatRow[], year: number | null, range?: { from: string | null; to: string | null }): Stats {
  let rows = year === null ? all : all.filter((row) => row.watchedOn?.startsWith(String(year)));
  if (range) rows = inRange(rows, range.from, range.to);

  const months = MONTH_NAMES.map((name, i) => ({
    label: name.slice(0, 3),
    value: rows.filter((row) => row.watchedOn !== null && row.watchedOn.length >= 7 && Number(row.watchedOn.slice(5, 7)) === i + 1).length,
  }));

  const weekdays = WEEKDAY_NAMES.map((name) => ({ label: name.slice(0, 3), value: 0 }));
  for (const row of rows) {
    if (row.watchedOn?.length !== 10) continue;
    const [y, m, d] = row.watchedOn.split("-").map(Number);
    weekdays[new Date(y, m - 1, d).getDay()].value++;
  }

  const rated = rows.filter((row) => row.rating !== null) as (StatRow & { rating: number })[];
  const ratings = Array.from({ length: 10 }, (_, i) => ({ label: `★ ${i + 1}`, value: 0 }));
  for (const row of rated) ratings[Math.min(10, Math.max(1, Math.round(row.rating))) - 1].value++;

  const years = tally(rows.map((row) => row.watchedOn?.slice(0, 4) ?? null), 50).sort((a, b) => b.label.localeCompare(a.label));
  const titles = new Set(rows.map((row) => row.mediaId)).size;

  return {
    viewings: rows.length,
    titles,
    rewatches: rows.length - titles,
    minutes: rows.reduce((sum, row) => sum + (row.runtime ?? 0), 0),
    tickets: rows.reduce((sum, row) => sum + (row.tickets ?? 0), 0),
    uniqueVenues: new Set(rows.flatMap((row) => (row.venue ? [row.venue] : []))).size,
    averageRating: rated.length > 0 ? rated.reduce((sum, row) => sum + row.rating, 0) / rated.length : null,
    months,
    years,
    weekdays,
    ratings,
    topTitles: tally(rows.map((row) => row.title)),
    venues: tally(rows.map((row) => row.venue)),
    formats: tally(rows.map((row) => row.format)),
    formatRatings: averages(rated.map((row) => [row.format, row.rating]), 2),
    categories: tally(rows.map((row) => row.category)),
    languages: tally(rows.map((row) => row.language)),
    genres: tally(rows.flatMap((row) => row.genres)),
    directors: tally(rows.flatMap((row) => row.directors)),
    actors: tally(rows.flatMap((row) => row.actors)),
    performers: tally(rows.flatMap((row) => row.performers)),
    bestActors: averages(rated.flatMap((row) => row.actors.map((actor): [string, number] => [actor, row.rating])), 2),
  };
}

/** "95 min" or "12 hours", whichever reads better. */
export function formatDuration(minutes: number): string {
  return minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} hours`;
}
