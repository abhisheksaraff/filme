// lib/ports/progress.ts
// How many episodes each season of a show has aired, kept so watching progress needs no lookup each time.
import type { SeasonCount } from "@/lib/domain/tv";

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
   * Aired episodes of each season (season 0 is the specials) for each show, by `showKey`. Saved counts are used as they are; a
   * show is asked about again only when its next episode has come due (or after a week for one with no date), a show never
   * seen before is asked once, and one saved before seasons were kept is asked once more.
   */
  airedSeasons(shows: ShowRef[]): Promise<Map<string, SeasonCount[]>>;
}
