// lib/showStacks.ts
// Loads one show's completion cards (a season or the series finished episode by episode) with what they are made from.
import type { StackNode } from "@/lib/domain/passes";
import { loadSeasons } from "@/lib/logShow";
import type { ViewingSummary } from "@/lib/ports/log";
import type { StackEdit } from "@/lib/ports/passes";
import { services } from "@/lib/services";
import { buildPasses } from "@/lib/showPasses";

export interface LoadedStacks {
  mediaId: string;
  title: string;
  posterPath: string | null;
  stacks: StackNode[];
  viewings: Map<string, ViewingSummary>;
  edits: StackEdit[];
}

/** Null when the show cannot be loaded or has no cards. */
export async function loadStacks(mediaId: string): Promise<LoadedStacks | null> {
  const detail = await services.log.titleDetail(mediaId);
  if (!detail.ok || detail.value.tmdbId === null) return null;
  const [data, resets, edits] = await Promise.all([loadSeasons(detail.value.tmdbId), services.passes.resets(mediaId), services.passes.edits(mediaId)]);
  if (!data.ok) return null;
  const built = buildPasses(detail.value.viewings, data.value, resets.ok ? resets.value : [], new Date().toISOString().slice(0, 10));
  if (built.stacks.length === 0) return null;
  return {
    mediaId,
    title: detail.value.title,
    posterPath: detail.value.posterPath,
    stacks: built.stacks,
    viewings: new Map(detail.value.viewings.map((v) => [v.id, v] as const)),
    edits: edits.ok ? edits.value : [],
  };
}
