// lib/ports/progress.ts
// How many episodes each show has aired, kept so watching progress needs no lookup each time.

/** A show to find the aired total for; give its TMDB id when it is known. */
export interface ShowRef {
  title: string;
  year: string | null;
  tmdbId?: number | null;
}

/** The key a total is returned under: the title and year in lower case. */
export const showKey = (title: string, year: string | null, normalize: (t: string) => string): string => `${normalize(title)}:${year ?? ""}`;

export interface ProgressRepository {
  /**
   * Episodes aired so far for each show, by `showKey`. Saved totals are used as they are; a show is asked about again only
   * when its next episode has come due (or after a week for one with no date), and a show never seen before is asked once.
   */
  airedTotals(shows: ShowRef[]): Promise<Map<string, number>>;
}
