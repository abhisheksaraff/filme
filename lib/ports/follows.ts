// lib/ports/follows.ts
import type { Cover } from "@/lib/domain/tv";
import type { Result } from "./result";

export type FollowMode = "on" | "off";

/** The latest episode known to have aired, as the daily check last found it. */
export interface AiredEpisode {
  season: number;
  episode: number;
  airDate: string | null;
  name: string | null;
}

/** A show the user has watched or followed, with what they have watched of it. */
export interface TrackedShow {
  mediaId: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  /** The user's own choice; null leaves it to the automatic rule. */
  mode: FollowMode | null;
  /** From the daily check; null until it has run for this show. */
  running: boolean | null;
  aired: AiredEpisode | null;
  checkedOn: string | null;
  /** Watched in the last twelve months. */
  recent: boolean;
  covers: Cover[];
}

/** Which shows get new-episode news: the user's choice, else shows watched in the last year that are still running. */
export interface FollowRepository {
  mode(mediaId: string): Promise<Result<FollowMode | null>>;
  /** null goes back to the automatic rule. */
  set(mediaId: string, mode: FollowMode | null): Promise<Result<void>>;
  /** Every show watched in the last year or followed by hand. */
  tracked(): Promise<Result<TrackedShow[]>>;
  saveCheck(mediaId: string, check: { running: boolean; aired: AiredEpisode | null; checkedOn: string }): Promise<Result<void>>;
}
