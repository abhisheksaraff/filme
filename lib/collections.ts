// lib/collections.ts
// Movie collections (trilogies, franchises) watched through like a season: the films in release order, your viewings of them, and passes.
import { computePasses, stacksOf, type PassViewing, type Passes, type StackNode } from "@/lib/domain/passes";
import type { CollectionDetail } from "@/lib/ports/catalog";
import type { CollectionViewing } from "@/lib/ports/log";
import type { StackEdit } from "@/lib/ports/passes";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const today = () => new Date().toISOString().slice(0, 10);

/** True once a film is out. A film with no date yet is not out: it does not count until TMDB gives it a release date that has passed. */
export const isOut = (p: { releaseDate: string | null }): boolean => !!p.releaseDate && p.releaseDate <= today();

/** Stands in for "no date yet", so the pass engine (which treats a missing date as aired) leaves the film out. */
const NOT_DATED = "9999-12-31";

/** A collection's films stand in for a season's episodes: season 1, "episode" = the film's TMDB id. */
export const partKey = (tmdbId: number) => ({ season: 1, episode: tmdbId });

export interface CollectionData {
  detail: CollectionDetail;
  viewings: CollectionViewing[];
  passes: Passes;
  edits: StackEdit[];
  stacks: StackNode[];
  /** The first film in release order that is out and not yet seen in the current pass; null when none. */
  next: CollectionDetail["parts"][number] | null;
}

const asPass = (v: CollectionViewing): PassViewing => ({ id: v.id, scope: "episode", season: 1, episode: v.tmdbId ?? -1, date: v.watchedOn, addedAt: v.addedAt });

export function buildCollection(detail: CollectionDetail, viewings: readonly CollectionViewing[], resets: Parameters<typeof computePasses>[2]): Omit<CollectionData, "edits"> {
  const episodes = detail.parts.map((p) => ({ ...partKey(p.tmdbId), airDate: p.releaseDate ?? NOT_DATED }));
  const passes = computePasses(viewings.map(asPass), episodes, resets, today(), 1);
  const have = new Set(passes.events.map((e) => e.episode));
  const next = detail.parts.find((p) => isOut(p) && !have.has(p.tmdbId)) ?? null;
  return { detail, viewings: [...viewings], passes, stacks: stacksOf(passes.passes, 1), next };
}

export async function loadCollection(collectionId: number): Promise<Result<CollectionData>> {
  const [detail, viewings, resets, edits] = await Promise.all([
    services.catalog.collection(collectionId),
    services.log.collectionViewings(collectionId),
    services.passes.resets({ collectionId }),
    services.passes.edits({ collectionId }),
  ]);
  if (!detail.ok) return fail(detail.error);
  if (!viewings.ok) return fail(viewings.error);
  return ok({ ...buildCollection(detail.value, viewings.value, resets.ok ? resets.value : []), edits: edits.ok ? edits.value : [] });
}
