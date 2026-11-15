// components/WatchedCard.tsx
// One viewing on the Watched page: a small map and theatre name, the poster, then title, seats and details.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon from "@/components/Icon";
import ViewingDetails from "@/components/ViewingDetails";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { scopeLabel } from "@/lib/domain/tv";
import type { RecentEntry } from "@/lib/ports/log";

/** Builds the map only once its tile scrolls into view, so a long list does not load twenty maps at once. */
function LazyMap({ entry }: { entry: RecentEntry & { venueLatitude: number; venueLongitude: number } }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const watcher = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) {
        setSeen(true);
        watcher.disconnect();
      }
    }, { rootMargin: "200px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [seen]);

  const icon = KIND_ICON[entry.category] ?? "film";
  const point = {
    id: entry.venueId as string, name: entry.venue ?? "", type: "cinema", city: null, country: null,
    latitude: entry.venueLatitude, longitude: entry.venueLongitude, count: 1, kinds: [{ category: entry.category, count: 1 }],
  };
  return (
    <div ref={box} className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
      {seen && <FlatMap points={[point]} focus={{ lon: point.longitude, lat: point.latitude, zoom: 14 }} still pinIcon={icon} className="h-full" />}
      {/* Tapping the map opens the full map on this theatre. */}
      <Link href={`/map/?venue=${entry.venueId}`} aria-label={`Show ${entry.venue} on the map`} className="absolute inset-0 z-30" />
    </div>
  );
}

export default function WatchedCard({ entry, index = 0 }: { entry: RecentEntry; index?: number }) {
  const poster = tmdbImageUrl(entry.posterPath, "w342");
  const located = entry.venueId && entry.venueLatitude !== null && entry.venueLongitude !== null;
  const at = entry.venueId && entry.venue;
  const episode = entry.category === "TV Show" ? scopeLabel(entry.season, entry.episode) : null;

  const posterEl = poster ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
  ) : (
    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl bg-neutral-200 dark:bg-neutral-800"><Icon name={KIND_ICON[entry.category] ?? "film"} size={28} /></div>
  );

  return (
    <li style={{ "--i": Math.min(index, 8) } as React.CSSProperties} className="reveal-item rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]">
      <div className="flex gap-4">
        {at ? (
          <div className="flex w-1/2 flex-col gap-2">
            {located ? <LazyMap entry={entry as RecentEntry & { venueLatitude: number; venueLongitude: number }} /> : (
              <Link href={`/venue/?id=${entry.venueId}`} aria-label={`Open ${entry.venue}`} className="flex aspect-square w-full items-center justify-center rounded-2xl bg-neutral-200 dark:bg-neutral-800"><Icon name={KIND_ICON[entry.category] ?? "film"} size={28} /></Link>
            )}
            <Link href={`/venue/?id=${entry.venueId}`} className="line-clamp-2 text-sm font-medium leading-tight underline decoration-neutral-300 underline-offset-4">{entry.venue}</Link>
          </div>
        ) : null}
        <Link href={`/session/?id=${entry.id}`} className={`flex flex-col gap-1 ${at ? "w-1/2" : "mx-auto w-2/3"}`}>
          {posterEl}
          {!at && <span className="text-center text-xs text-neutral-500">Watched at home</span>}
        </Link>
      </div>
      <Link href={`/session/?id=${entry.id}`} className="mt-3 flex flex-col gap-2">
        <span className="font-serif text-xl leading-tight">{entry.title}</span>
        {episode && <span className="text-sm text-neutral-600 dark:text-neutral-400">{episode}</span>}
        <ViewingDetails auditorium={entry.auditorium} seats={entry.seats} totalTickets={entry.totalTickets} format={entry.primaryFormat} addons={entry.addons} watchedOn={entry.watchedOn} watchedAt={entry.watchedAt} />
      </Link>
    </li>
  );
}
