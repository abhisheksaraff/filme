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

export interface RatingsRepository {
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
