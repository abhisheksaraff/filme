// lib/ports/ratings.ts
import type { CatalogKind } from "./catalog";
import type { Result } from "./result";

/** What a title page needs for its IMDb link and rating line. */
export interface TitleLinks {
  /** null when the title was added by hand or the catalogue has no IMDb page for it. */
  imdbId: string | null;
  /** IMDb's own rating, from OMDb; null without an OMDb key or when IMDb has none. */
  imdbRating: number | null;
  /** The catalogue's rating, shown instead when IMDb's is not available. */
  tmdbRating: number | null;
}

/** A title to show a score for: one saved in the log (by mediaId) or one the catalogue knows (by TMDB id). */
export interface ScoreItem {
  mediaId?: string | null;
  kind: CatalogKind;
  tmdbId: number | null;
  /** The catalogue's own rating when the caller already has it; shown if IMDb has none. */
  tmdbRating?: number | null;
  /** When it came out, if known; a recent release with no IMDb score yet is looked at again daily. */
  releaseDate?: string | null;
}

/** The key a score is returned under: the saved title's id, else the kind and TMDB id. */
export const scoreKey = (item: Pick<ScoreItem, "mediaId" | "kind" | "tmdbId">): string => item.mediaId ?? `${item.kind}:${item.tmdbId}`;

/** A title or episode a card wants IMDb's page and rating for. */
export interface CardTitle {
  /** Where the answer is returned: the saved title's id, plus season and episode for an episode. */
  key: string;
  mediaId: string;
  kind: CatalogKind;
  season?: number | null;
  episode?: number | null;
}

export interface ImdbInfo {
  imdbId: string;
  rating: number | null;
}

export const cardKey = (mediaId: string, season?: number | null, episode?: number | null): string => (season != null && episode != null ? `${mediaId}:${season}:${episode}` : mediaId);

export interface RatingsRepository {
  /**
   * IMDb's page and rating for the titles and episodes on screen, as saved. Anything not saved yet (or a month old) is looked up
   * in the background, a couple at a time, and each answer is passed to `onInfo`.
   */
  cardLinks(items: CardTitle[], onInfo: (key: string, info: ImdbInfo) => void): Promise<Map<string, ImdbInfo>>;

  /**
   * The best score known for each title, now: IMDb when saved, else the catalogue's. Titles with no saved IMDb score are
   * then looked up in the background (at most `fill` of them, a few at a time) and each answer is passed to `onScore`.
   * Titles with no score at all are left out of the map, so nothing is drawn for them.
   */
  scores(items: ScoreItem[], opts?: { fill?: number; onScore?: (key: string, score: number) => void }): Promise<Map<string, number>>;

  /**
   * Finds a title's IMDb id and ratings. Saved ratings are reused for a week, so opening the same title
   * again does not use up a lookup. `known` is what the page already has from the catalogue.
   */
  forTitle(input: {
    mediaId: string | null;
    kind: CatalogKind;
    tmdbId: number | null;
    known?: { imdbId: string | null; tmdbRating: number | null };
  }): Promise<Result<TitleLinks>>;
}
