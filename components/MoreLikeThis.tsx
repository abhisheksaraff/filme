// components/MoreLikeThis.tsx
// A row of titles like this one: TMDB's recommendations, or its "similar" list when there are none. Titles you marked
// "Not interested" and the title itself are left out, and the row does not appear at all when nothing is left.
"use client";

import { useEffect, useState } from "react";
import PosterRow from "@/components/PosterRow";
import { previewHref, seenKey, type RowItem } from "@/lib/home/rows";
import type { CatalogKind } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

const MAX = 20;

export default function MoreLikeThis({ kind, tmdbId }: { kind: CatalogKind; tmdbId: number }) {
  const [items, setItems] = useState<RowItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [recs, hidden] = await Promise.all([services.catalog.recommendations({ kind, tmdbId }), services.hidden.list()]);
      let hits = recs.ok ? recs.value : [];
      // Older or lesser-known titles often have no recommendations; "similar" still has an answer.
      if (hits.length === 0) {
        const similar = await services.catalog.similar({ kind, tmdbId });
        hits = similar.ok ? similar.value : [];
      }
      const hiddenKeys = new Set(hidden.ok ? hidden.value.map((h) => seenKey(h.category, h.tmdbId)) : []);
      const next = hits
        .filter((h) => h.tmdbId !== tmdbId && !hiddenKeys.has(seenKey(h.kind, h.tmdbId)))
        .slice(0, MAX)
        .map((h): RowItem => ({ key: seenKey(h.kind, h.tmdbId), title: h.title, subtitle: h.year, posterUrl: h.posterUrl, href: previewHref(h.kind, h.tmdbId) }));
      if (!cancelled) setItems(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, tmdbId]);

  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-lg">More like this</h2>
      <PosterRow items={items} />
    </section>
  );
}
