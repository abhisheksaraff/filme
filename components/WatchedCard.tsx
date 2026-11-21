// components/WatchedCard.tsx
// One viewing: a small map and theatre name, the poster, then title, seats and details. It starts folded, showing the first
// seats, the format and little picture circles; tapping it lifts the card above the page and rolls the rest out over the cards below
// (nothing else moves), with the edit button floating over it.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon, { type IconName } from "@/components/Icon";
import ImageViewer from "@/components/ImageViewer";
import RoundButton from "@/components/RoundButton";
import ViewingDetails from "@/components/ViewingDetails";
import { useCardImdb } from "@/hooks/useCardImdb";
import { useViewingPictures } from "@/hooks/useViewingPictures";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { scopeLabel } from "@/lib/domain/tv";
import type { SeatDetail } from "@/lib/domain/sessions";
import type { VenuePoint } from "@/lib/ports/browse";
import type { StoredImage } from "@/lib/ports/images";
import { reportFolded, useTallestFolded } from "@/lib/foldedHeight";
import { useOpenCard } from "@/lib/openCard";

/** True when the list has more than one column (tablet and wider), where an opened card must not move its neighbours. */
function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 768px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}
import { readCachedAppearance } from "@/lib/theme";
import { formatScore } from "@/lib/domain/score";
import { effectiveVenueType, venueIcon } from "@/lib/domain/venueTypes";

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
  /** The kind of place, which picks the icon on its small map. */
  venueType?: string | null;
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  season: number | null;
  episode: number | null;
}

/** Where a viewing with no venue is drawn: the CN Tower, with a pin that says there is no location. */
const CN_TOWER: VenuePoint = { id: "none", name: "No location", type: "other", city: null, country: null, latitude: 43.6426, longitude: -79.3871, count: 1, kinds: [], types: [] };

/** True once the element has come near the screen; a long list then does not load every map and picture at once. */
function useNearScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const watcher = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) {
        setSeen(true);
        watcher.disconnect();
      }
    }, { rootMargin: "200px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [ref, seen]);
  return seen;
}

/**
 * A small still map. Tapping it goes to `href` (the full map on the venue); with `onTap` instead it only does that,
 * which is how the "no location" map behaves, as it has nowhere to go.
 */
function SmallMap({ point, icon, href, label, onTap }: { point: VenuePoint; icon: IconName; href?: string; label: string; onTap?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const seen = useNearScreen(box);
  return (
    <div ref={box} className="relative isolate aspect-square w-full overflow-hidden rounded-[20px] bg-neutral-200 dark:bg-neutral-800">
      {seen && <FlatMap points={[point]} focus={{ lon: point.longitude, lat: point.latitude, zoom: 14 }} still pinIcon={icon} className="h-full" />}
      {href ? (
        <Link href={href} aria-label={label} className="absolute inset-0 z-30" />
      ) : (
        <button type="button" aria-label={label} onClick={onTap} className="absolute inset-0 z-30" />
      )}
    </div>
  );
}

/** Ticket stubs and photos as small overlapping circles. With more than three, two pictures then two black circles say there is more. */
function PictureStack({ images }: { images: StoredImage[] }) {
  const [start, setStart] = useState<number | null>(null);
  if (images.length === 0) return null;
  const many = images.length > 3;
  const shown = many ? images.slice(0, 2) : images;
  return (
    <>
      <ul className="relative top-[3px] z-10 ml-auto flex items-center pl-3" aria-label="Photos and stubs">
        {shown.map((image, i) => (
          <li key={image.id} className={i > 0 ? "-ml-3" : ""}>
            <button type="button" onClick={() => setStart(0)} aria-label={image.note ?? `Picture ${i + 1}`}
              className="block h-8 w-8 overflow-hidden rounded-full bg-neutral-200 shadow-md ring-2 ring-white dark:bg-neutral-800 dark:ring-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
        {many && [2, 3].map((n) => (
          <li key={n} className="-ml-3">
            <button type="button" onClick={() => setStart(0)} aria-label="More pictures"
              className="block h-8 w-8 rounded-full bg-neutral-950 shadow-[0_3px_8px_rgba(0,0,0,0.45)] ring-2 ring-white dark:ring-neutral-900" />
          </li>
        ))}
      </ul>
      {/* View only: no upload, note or delete handlers, so the viewer offers none of them. */}
      {start !== null && <ImageViewer images={images} start={start} onClose={() => setStart(null)} />}
    </>
  );
}

interface Props {
  entry: CardData;
  index?: number;
  /** False on a title page, where the title is already the heading. */
  showTitle?: boolean;
  /** "First viewing", "Second viewing" and so on. */
  label?: string;
  notes?: string | null;
  /** Rises into place as the page opens; only the title page does this. */
  animate?: boolean;
  /** Where the edit button goes; a viewing's own edit page when left out. */
  editHref?: string | null;
  /** A completion card: the stacked-cards button is always on show (top right), and opens the cards it was made from. */
  onStack?: () => void;
  /** The viewing whose pictures the card shows, when they are another's (a completion card mirrors its last episode). */
  pictureId?: string;
  /** The completion card whose own pictures to show instead (once it has some). */
  completionId?: string;
  /** Makes the label a link in the title's style (a completion card's "<Name> Completed"). */
  labelHref?: string;
  /** Where the poster goes, when not the title's page. */
  posterHref?: string;
  /** No title line under the poster (a collection's card, which has no single title). */
  hideTitle?: boolean;
  /** No IMDb rating on this card (seasons and collections have none). */
  noRating?: boolean;
}

export default function WatchedCard({ entry, index = 0, showTitle = true, label, notes, animate = false, editHref, onStack, pictureId, completionId, labelHref, posterHref, hideTitle = false, noRating = false }: Props) {
  // Keyed by page too, so the same viewing opened on Watched is not also open on its title page.
  const path = usePathname();
  const wide = useWide();
  const { open, toggle } = useOpenCard(`${path}|${entry.id}`, wide);
  const root = useRef<HTMLLIElement>(null);
  const near = useNearScreen(root);
  // Folded height: this card reports how tall its content is without the stretch, and takes the tallest on the page (wide screens only).
  const fold = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const tallestFolded = useTallestFolded(path);
  useEffect(() => {
    const el = fold.current;
    if (!el) return;
    const measure = () => reportFolded(path, entry.id, el.offsetHeight - (spacer.current?.offsetHeight ?? 0));
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => {
      watcher.disconnect();
      reportFolded(path, entry.id, null);
    };
  }, [path, entry.id]);
  // The rolled-out part's own height. The card gives that much room back to the list, so rolling out lays the extra details over the
  // cards below instead of pushing them down.
  const extra = useRef<HTMLDivElement>(null);
  const [extraHeight, setExtraHeight] = useState(0);
  useEffect(() => {
    const el = extra.current;
    if (!el) return;
    const measure = () => setExtraHeight(el.offsetHeight);
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  const images = useViewingPictures(pictureId ?? entry.id, near, completionId);
  // IMDb's rating sits on the title line: a film's own, a show's own, or the episode's. Seasons and collections have none.
  const isShow = entry.category === "TV Show";
  const whole = !noRating && showTitle && !hideTitle && (!isShow || (entry.episode === null && entry.season === null));
  const ofEpisode = !noRating && showTitle && !hideTitle && isShow && entry.episode !== null && entry.season !== null;
  const imdb = useCardImdb(whole || ofEpisode ? entry.mediaId : null, isShow ? "TV Show" : "Movie", near && (whole || ofEpisode), ofEpisode ? entry.season : null, ofEpisode ? entry.episode : null);
  // The roll-out is smooth unless animations are switched off, when it just snaps.
  const [smooth] = useState(() => readCachedAppearance().animationsEnabled);

  const poster = tmdbImageUrl(entry.posterPath, "w342");
  const located = entry.venueId && entry.venueLatitude !== null && entry.venueLongitude !== null;
  const at = entry.venueId && entry.venue;
  const episode = entry.category === "TV Show" ? scopeLabel(entry.season, entry.episode) : null;
  const titleHref = `/title/?id=${entry.mediaId}`;
  const ease = smooth ? "transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" : "";

  const posterEl = (
    <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-neutral-200 dark:bg-neutral-800">
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
    // One column: an open card grows and pushes the ones below it down. Several columns: every closed card already keeps room below it for
    // its details, which the open card fills, so nothing around it moves.
    <li ref={root} id={`v-${entry.id}`} style={{ "--i": Math.min(index, 8), "--folded": `${tallestFolded}px`, marginBottom: wide && !open ? extraHeight : 0 } as React.CSSProperties}
      className={`${animate ? "rise-item" : ""} relative scroll-mt-24 rounded-3xl bg-white p-1 ${smooth ? "transition-[box-shadow,transform,margin-bottom] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""} dark:bg-neutral-900 ${
        open
          ? `shadow-[0_2px_4px_rgba(0,0,0,0.08),0_24px_44px_-10px_rgba(0,0,0,0.45),0_8px_16px_rgba(0,0,0,0.14)] dark:shadow-[0_24px_44px_-10px_rgba(0,0,0,0.95)]`
          : "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
      }`}>
      {/* Tapping the card anywhere else rolls it out or back up. The title, poster, map, venue name and pictures sit above this and keep their own taps. */}
      <button type="button" aria-expanded={open} aria-label={`${open ? "Fold" : "Unfold"} ${entry.title}`} onClick={toggle} className="absolute inset-0 z-0 rounded-3xl" />

      {/* The only way to the edit screen: it floats over the top-right corner once the card is open, above everything else on the card. */}
      <div className="absolute right-3 top-3 z-40 flex items-center gap-2">
        <div className={`${smooth ? "transition-[opacity,transform] duration-300" : ""} ${open && editHref !== null ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}>
          <RoundButton icon="edit" label="Edit viewing" href={editHref ?? `/entry/?id=${entry.id}`} className="relative !bg-black !text-white shadow-[0_6px_16px_rgba(0,0,0,0.4)] before:absolute before:-inset-3 before:content-['']" />
        </div>
        {onStack && <RoundButton icon="fan" label="Show the episodes" onClick={onStack} className="relative !bg-black !text-white shadow-[0_6px_16px_rgba(0,0,0,0.4)] before:absolute before:-inset-3 before:content-['']" />}
      </div>

      <div ref={fold} className="flex flex-col md:min-h-[var(--folded)]">
      {label && (labelHref ? (
        // Room is kept on the right for the buttons, so the name never sits under them and a tap here is only ever the name.
        <div className="mb-1 pl-3 pr-28 pt-2">
          <Link href={labelHref} className="relative z-10 line-clamp-2 w-fit max-w-full font-serif text-xl font-medium leading-tight no-underline">{label}</Link>
        </div>
      ) : (
        <span className={`mb-1 block px-3 pt-2 text-xs uppercase tracking-wide text-neutral-500 `}>{label}</span>
      ))}
      <div className="flex gap-1">
        <div className="flex w-1/2 flex-col gap-1">
          {at ? (
            located ? (
              <SmallMap
                point={{ id: entry.venueId as string, name: entry.venue ?? "", type: "cinema", city: null, country: null, latitude: entry.venueLatitude as number, longitude: entry.venueLongitude as number, count: 1, kinds: [{ category: entry.category, count: 1 }], types: [] }}
                icon={venueIcon(effectiveVenueType(entry.venueType, null, entry.category))}
                href={`/map/?venue=${entry.venueId}`}
                label={`Show ${entry.venue} on the map`}
              />
            ) : (
              <Link href={`/map/?venue=${entry.venueId}`} aria-label={`Show ${entry.venue} on the map`} className="relative z-10 flex aspect-square w-full items-center justify-center rounded-[20px] bg-neutral-200 dark:bg-neutral-800"><Icon name={venueIcon(effectiveVenueType(entry.venueType, null, entry.category))} size={28} /></Link>
            )
          ) : (
            // No venue: a map of the CN Tower with a "none" pin. It goes nowhere; a tap rolls the card out like the rest of it.
            <SmallMap point={CN_TOWER} icon="none" label={`Unfold ${entry.title}`} onTap={toggle} />
          )}
          {at && <Link href={`/map/?venue=${entry.venueId}`} className="relative z-10 line-clamp-2 px-2 pb-1 text-sm font-normal leading-tight text-neutral-500">{entry.venue}</Link>}
        </div>
        <div className="flex w-1/2 flex-col gap-1">
          {showTitle ? <Link href={posterHref ?? titleHref} aria-label={`Open ${entry.title}`} className="relative z-10 block">{posterEl}</Link> : posterEl}
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2 px-3">
        {showTitle && !hideTitle && (
          <div className="flex items-start justify-between gap-3">
            {/* About as long as "Spider-Man: Brand New Day" fits on a line; longer names go to a second line, then "…". */}
            <Link href={titleHref} className="relative z-10 line-clamp-2 min-w-0 max-w-[15.5rem] font-serif text-xl font-medium leading-tight">{entry.title}</Link>
            {imdb && imdb.rating !== null && (
              <a href={`https://www.imdb.com/title/${imdb.imdbId}/`} target="_blank" rel="noopener noreferrer" aria-label={`IMDb rating ${formatScore(imdb.rating)}`} className="relative z-10 shrink-0 pt-1 text-sm text-neutral-500">★ {formatScore(imdb.rating)}</a>
            )}
          </div>
        )}
        {episode && <span className="text-sm text-neutral-600 dark:text-neutral-400">{episode}</span>}
      </div>

      <div ref={spacer} className="flex-1" />
      <div className="px-3 pt-2">
        <ViewingDetails view="summary" auditorium={entry.auditorium} seats={entry.seats} totalTickets={entry.totalTickets} format={entry.primaryFormat} addons={entry.addons} watchedOn={entry.watchedOn} watchedAt={entry.watchedAt} trailing={<PictureStack images={images} />} />
      </div>

      </div>

      {/* Rolls out below: the auditorium, any more seats (on as many rows as needed), extras and notes. */}
      <div inert={!open} className={`grid ${ease} ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div ref={extra} className="flex flex-col gap-2 px-3 pt-2">
            <ViewingDetails view="more" auditorium={entry.auditorium} seats={entry.seats} totalTickets={entry.totalTickets} format={entry.primaryFormat} addons={entry.addons} watchedOn={null} watchedAt={null} />
            {notes && <p className="select-text text-sm">{notes}</p>}
          </div>
        </div>
      </div>
      <div aria-hidden className="h-3" />
    </li>
  );
}
