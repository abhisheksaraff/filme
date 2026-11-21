// hooks/useShowPasses.ts
// A show's passes, with the resets and card edits saved for it, and whether it is on Continue watching.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { continueCandidates } from "@/lib/shows";
import { hasMoreAfter, placeIn } from "@/lib/domain/tv";
import type { Reset } from "@/lib/domain/passes";
import type { ShowData } from "@/lib/logShow";
import type { ViewingSummary } from "@/lib/ports/log";
import type { StackEdit } from "@/lib/ports/passes";
import { buildPasses, type ShowPasses } from "@/lib/showPasses";
import { services } from "@/lib/services";

const today = () => new Date().toISOString().slice(0, 10);

export interface ShowPassState {
  passes: ShowPasses | null;
  edits: StackEdit[];
  /** True while the show is on Home's Continue watching; progress rings only show then. */
  inContinue: boolean;
  /** Empties the rewatch in progress for a season (or the series when null). */
  reset: (season: number | null) => Promise<string | null>;
  refresh: () => void;
}

export function useShowPasses(mediaId: string | null, viewings: readonly ViewingSummary[], data: ShowData | null): ShowPassState {
  const [resets, setResets] = useState<Reset[]>([]);
  const [edits, setEdits] = useState<StackEdit[]>([]);
  const [inContinue, setInContinue] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    if (!mediaId) return;
    let cancelled = false;
    Promise.all([services.passes.resets(mediaId), services.passes.edits(mediaId), services.follows.tracked()]).then(([r, e, t]) => {
      if (cancelled) return;
      if (r.ok) setResets(r.value);
      if (e.ok) setEdits(e.value);
      setInContinue(false);
      if (t.ok && data) {
        const mine = t.value.find((s) => s.mediaId === mediaId);
        const aired = data.seasons.map((s) => ({ season: s.season, episodes: s.episodes.filter((x) => !x.airDate || x.airDate <= today()).length }));
        if (mine && continueCandidates([mine]).length > 0) setInContinue(hasMoreAfter(placeIn(mine.latest, aired)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId, data, version, viewings]);

  const passes = useMemo(() => (data ? buildPasses(viewings, data, resets, today()) : null), [viewings, data, resets]);

  const reset = useCallback(
    async (season: number | null) => {
      if (!mediaId) return "This show is not in your log yet.";
      const res = await services.passes.reset(mediaId, season);
      if (!res.ok) return res.error;
      refresh();
      return null;
    },
    [mediaId, refresh],
  );

  return { passes, edits, inContinue, reset, refresh };
}
