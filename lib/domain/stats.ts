// lib/domain/stats.ts
// Counts and totals over the user's viewings.

/** The few facts about one viewing that statistics and stories need. */
export interface StatRow {
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
  /** YYYY, YYYY-MM or YYYY-MM-DD. */
  watchedOn: string | null;
  runtime: number | null;
  venue: string | null;
  format: string | null;
  rating: number | null;
  tickets: number | null;
  language: string | null;
}

export interface Count {
  label: string;
  value: number;
}

export interface Stats {
  viewings: number;
  titles: number;
  minutes: number;
  tickets: number;
  averageRating: number | null;
  /** January to December, for the rows given. */
  months: Count[];
  years: Count[];
  weekdays: Count[];
  ratings: Count[];
  topTitles: Count[];
  venues: Count[];
  formats: Count[];
  categories: Count[];
  languages: Count[];
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

/** The years that appear in the log, newest first. */
export function statYears(rows: StatRow[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    const year = Number(row.watchedOn?.slice(0, 4));
    if (Number.isInteger(year) && year > 0) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

export function computeStats(all: StatRow[], year: number | null): Stats {
  const rows = year === null ? all : all.filter((row) => row.watchedOn?.startsWith(String(year)));

  const months = MONTH_NAMES.map((name, i) => ({
    label: name.slice(0, 3),
    value: rows.filter((row) => row.watchedOn?.length !== undefined && row.watchedOn.length >= 7 && Number(row.watchedOn.slice(5, 7)) === i + 1).length,
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

  return {
    viewings: rows.length,
    titles: new Set(rows.map((row) => row.mediaId)).size,
    minutes: rows.reduce((sum, row) => sum + (row.runtime ?? 0), 0),
    tickets: rows.reduce((sum, row) => sum + (row.tickets ?? 0), 0),
    averageRating: rated.length > 0 ? rated.reduce((sum, row) => sum + row.rating, 0) / rated.length : null,
    months,
    years,
    weekdays,
    ratings,
    topTitles: tally(rows.map((row) => row.title)),
    venues: tally(rows.map((row) => row.venue)),
    formats: tally(rows.map((row) => row.format)),
    categories: tally(rows.map((row) => row.category)),
    languages: tally(rows.map((row) => row.language)),
  };
}

/** "95 min" or "12 hours", whichever reads better. */
export function formatDuration(minutes: number): string {
  return minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} hours`;
}
