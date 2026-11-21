// components/CollectionCard.tsx
// On a film's page: "Part of The Dark Knight Trilogy · 2 of 3 watched", opening the collection's page.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { loadCollection } from "@/lib/collections";
import { services } from "@/lib/services";

export default function CollectionCard({ tmdbId }: { tmdbId: number }) {
  const [info, setInfo] = useState<{ id: number; name: string; posterPath: string | null; seen: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await services.catalog.details({ tmdbId, kind: "Movie" });
      if (cancelled || !found.ok || !found.value.collection) return;
      const res = await loadCollection(found.value.collection.id);
      if (cancelled || !res.ok) return;
      const seen = new Set(res.value.viewings.map((v) => v.tmdbId)).size;
      setInfo({ id: res.value.detail.id, name: res.value.detail.name, posterPath: res.value.detail.posterPath, seen, total: res.value.detail.parts.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  if (!info) return null;
  const poster = tmdbImageUrl(info.posterPath, "w185");
  return (
    <Link href={`/collection/?id=${info.id}`} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="aspect-[2/3] w-12 shrink-0 rounded-lg bg-neutral-300 dark:bg-neutral-700" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Part of</span>
        <span className="font-serif text-base leading-tight">{info.name}</span>
        <span className="text-neutral-500">{info.seen} of {info.total} watched</span>
      </span>
    </Link>
  );
}
