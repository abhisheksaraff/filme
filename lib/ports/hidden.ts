// lib/ports/hidden.ts
import type { CatalogKind } from "./catalog";
import type { Result } from "./result";

/** A title marked "Not interested": kept out of Home until the user undoes it. */
export interface HiddenTitle {
  category: CatalogKind;
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

export interface HiddenRepository {
  list(): Promise<Result<HiddenTitle[]>>;
  hide(title: HiddenTitle): Promise<Result<void>>;
  restore(category: CatalogKind, tmdbId: number): Promise<Result<void>>;
}
