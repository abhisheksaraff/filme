// hooks/useGenres.ts
// A title's genres from the catalogue (kept for a day, so this is usually instant), for pages that do not load the whole title.
"use client";

import { useEffect, useState } from "react";
import type { CatalogKind } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

export function useGenres(kind: CatalogKind, tmdbId: number | null): string[] {
  const [genres, setGenres] = useState<string[]>([]);
  useEffect(() => {
    if (tmdbId === null) return;
    let cancelled = false;
    services.catalog.details({ kind, tmdbId }).then((res) => {
      if (!cancelled && res.ok) setGenres(res.value.genres);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, tmdbId]);
  return genres;
}
