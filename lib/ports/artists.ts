// lib/ports/artists.ts
import type { Result } from "./result";

export interface ArtistHit {
  id: string;
  name: string;
  /** MusicBrainz's short note to tell artists with the same name apart, e.g. "UK rock band". */
  note: string | null;
}

/** Finds musicians and bands for concert performers. */
export interface ArtistSearch {
  search(query: string): Promise<Result<ArtistHit[]>>;
}
