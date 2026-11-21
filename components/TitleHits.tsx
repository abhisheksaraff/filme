// components/TitleHits.tsx
// The TMDB titles that match what was typed in the title box, as a list to pick from, plus the search that fills it.
"use client";

import { useEffect, useState } from "react";
import SuggestionList, { SUGGESTION_NOTE, SuggestionItem } from "@/components/ui/SuggestionList";
import type { CatalogHit } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

export function TitleHits({ hits, onPick }: { hits: CatalogHit[]; onPick: (hit: CatalogHit) => void }) {
  if (hits.length === 0) return null;
  return (
    <SuggestionList>
      {hits.map((hit) => (
        <SuggestionItem key={`${hit.kind}-${hit.tmdbId}`}>
          <button type="button" onClick={() => onPick(hit)} className="flex w-full items-center gap-3 p-2 text-left">
            {hit.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hit.posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-14 w-10 rounded-lg bg-neutral-300 dark:bg-neutral-600" />
            )}
            <span className="flex flex-col text-sm">
              <span className="font-medium">{hit.title}</span>
              <span className={SUGGESTION_NOTE}>{[hit.year, hit.kind].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        </SuggestionItem>
      ))}
    </SuggestionList>
  );
}

/** Searches TMDB a moment after the title stops changing. `done` hides the list once a title has been picked, until the text changes again. */
export function useTitleHits(title: string, category: string, enabled: boolean): { hits: CatalogHit[]; done: () => void } {
  const key = `${category}|${title.trim()}`;
  const [found, setFound] = useState<{ key: string; items: CatalogHit[] }>({ key: "", items: [] });
  const [dismissed, setDismissed] = useState("");
  const searchable = enabled && title.trim().length >= 2 && (category === "Movie" || category === "TV Show");

  useEffect(() => {
    if (!searchable) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const res = await services.catalog.search(title, category as "Movie" | "TV Show");
      if (!stale) setFound({ key, items: res.ok ? res.value : [] });
    }, 500);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [searchable, key, title, category]);

  return { hits: searchable && found.key === key && dismissed !== key ? found.items : [], done: () => setDismissed(key) };
}
