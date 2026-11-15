// hooks/useShowData.ts
// A show's seasons and episodes, loaded once its page is ready; null while loading or if TMDB could not be reached.
"use client";

import { useEffect, useState } from "react";
import { loadSeasons, type ShowData } from "@/lib/logShow";

export function useShowData(tmdbId: number | null, enabled: boolean): ShowData | null {
  const [data, setData] = useState<{ tmdbId: number; value: ShowData } | null>(null);

  useEffect(() => {
    if (!enabled || tmdbId === null) return;
    let cancelled = false;
    loadSeasons(tmdbId).then((res) => {
      if (!cancelled && res.ok) setData({ tmdbId, value: res.value });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, tmdbId]);

  return data && data.tmdbId === tmdbId ? data.value : null;
}
