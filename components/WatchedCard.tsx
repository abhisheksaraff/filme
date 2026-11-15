// components/WatchedCard.tsx
// One viewing on the Watched page: a small map and theatre name, the poster, then title, seats and details.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import ViewingDetails from "@/components/ViewingDetails";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { scopeLabel } from "@/lib/domain/tv";
import type { SeatDetail } from "@/lib/domain/sessions";
import type { ReactNode } from "react";

/** What a card needs; a Watched row and a viewing on a title page both fit it. */
export interface CardData {
  id: string;
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
  watchedOn: string | null;
  watchedAt: string | null;
  primaryFormat: string | null;
  addons: string[];
  venueId: string | null;
  venue: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  season: number | null;
  episode: number | null;
}

/** Builds the map only once its tile scrolls into view, so a long list does not load twenty maps at once. */
function LazyMap({ entry }: { entry: CardData & { venueLatitude: number; venueLongitude: number } }) {
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

interface Props {
  entry: CardData;
  index?: number;
  /** Where the card body goes; the default opens the title at this viewing. */
  href?: string;
  /** False on a title page, where the title is already the heading. */
  showTitle?: boolean;
  /** "First viewing", "Second viewing" and so on. */
  label?: string;
  rating?: number | null;
  notes?: string | null;
  /** Round photo thumbnails and stubs, under the details. */
  footer?: ReactNode;
  /** A small black pencil in the bottom-right corner. */
  editHref?: string;
  /** Extra round buttons beside the pencil, such as Watch. */
  actions?: ReactNode;
  highlight?: boolean;
}

export default function WatchedCard({ entry, index = 0, href, showTitle = true, label, rating, notes, footer, editHref, actions, highlight }: Props) {
  const poster = tmdbImageUrl(entry.posterPath, "w342");
  const located = entry.venueId && entry.venueLatitude !== null && entry.venueLongitude !== null;
  const at = entry.venueId && entry.venue;
  const episode = entry.category === "TV Show" ? scopeLabel(entry.season, entry.episode) : null;
  const open = href ?? `/title/?id=${entry.mediaId}&v=${entry.id}`;

  const posterEl = (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center"><Icon name={KIND_ICON[entry.category] ?? "film"} size={28} /></div>
      )}
      {/* A soft fade at the foot so the picture settles into the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );

  return (
    <li id={`v-${entry.id}`} style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
      className={`reveal-item relative scroll-mt-24 rounded-3xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)] ${highlight ? "ring-2 ring-neutral-950 dark:ring-white" : ""}`}>
      {label && <span className="mb-2 block px-1.5 pt-0.5 text-xs uppercase tracking-wide text-neutral-500">{label}</span>}
      <div className="flex gap-2.5">
        {at ? (
          <div className="flex w-1/2 flex-col gap-2">
            {located ? <LazyMap entry={entry as CardData & { venueLatitude: number; venueLongitude: number }} /> : (
              <Link href={`/venue/?id=${entry.venueId}`} aria-label={`Open ${entry.venue}`} className="flex aspect-square w-full items-center justify-center rounded-2xl bg-neutral-200 dark:bg-neutral-800"><Icon name={KIND_ICON[entry.category] ?? "film"} size={28} /></Link>
            )}
            <Link href={`/venue/?id=${entry.venueId}`} className="line-clamp-2 text-sm font-normal leading-tight text-neutral-500">{entry.venue}</Link>
          </div>
        ) : null}
        <Link href={open} className={`flex flex-col gap-1 ${at ? "w-1/2" : "mx-auto w-1/2"}`}>
          {posterEl}
          {!at && <span className="text-center text-xs text-neutral-500">Watched at home</span>}
        </Link>
      </div>
      <Link href={open} className="mt-3 flex flex-col gap-2 px-1.5">
        {showTitle && <span className="font-serif text-xl font-medium leading-tight">{entry.title}</span>}
        {(episode || rating != null) && (
          <span className="flex items-baseline justify-between text-sm text-neutral-600 dark:text-neutral-400">
            <span>{episode}</span>
            {rating != null && <span>★ {rating}</span>}
          </span>
        )}
      </Link>
      {/* Outside the link above, since the format and extras are links of their own. */}
      <div className="mt-2 flex flex-col gap-2 px-1.5 pb-1">
        <ViewingDetails links auditorium={entry.auditorium} seats={entry.seats} totalTickets={entry.totalTickets} format={entry.primaryFormat} addons={entry.addons} watchedOn={entry.watchedOn} watchedAt={entry.watchedAt} />
        {notes && <p className="text-sm">{notes}</p>}
      </div>
      {footer}
      {(editHref || actions) && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {actions}
          {editHref && <RoundButton icon="edit" label="Edit viewing" href={editHref} size="sm" className="!bg-black !text-white" />}
        </div>
      )}
    </li>
  );
}
