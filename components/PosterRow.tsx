// components/PosterRow.tsx
// A sideways-scrolling strip of posters (or a grid of them on a See all page). Tapping a poster opens its page.
"use client";

import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { warmTitle } from "@/lib/handoff";
import { useWantedKeys, wantedKeyOf } from "@/lib/useWantedKeys";
import type { RowItem } from "@/lib/home/rows";

/** The biggest the ring grows, in pixels. */
const RING_MAX = 24;

interface Props {
  items: RowItem[];
  /** Lays the posters out in a grid that wraps instead of one sideways strip. */
  grid?: boolean;
  /** Home's rows: posters a fifth bigger with half the gap, the ring and badges keeping their size but nearer the corner. */
  home?: boolean;
}

export default function PosterRow({ items, grid, home }: Props) {
  const wanted = useWantedKeys();
  // The same few pixels from the corner on a bigger poster means a smaller share of it.
  const corner = home ? "right-[3.4%] top-[2.5%]" : "right-[4%] top-[3%]";

  return (
    <ul className={grid ? "grid grid-cols-3 gap-x-1.5 gap-y-4 md:grid-cols-5 lg:grid-cols-6" : `-mx-5 flex ${home ? "gap-1.5 [--n:6] min-[1400px]:[--n:7] wide:mx-0 wide:px-0" : "gap-3"} overflow-x-auto px-5 pb-2`}>
      {items.map((item) => {
        const partly = item.progress !== undefined;
        return (
          <li key={item.key} className={grid ? "min-w-0" : home ? "w-[134px] shrink-0 md:w-[173px] lg:w-[192px] wide:w-[calc((100%_-_(var(--n)_-_1)*6px)/var(--n))]" : "w-28 shrink-0 md:w-36 lg:w-40"}>
            <Link
              href={item.href}
              onClick={() => warmTitle(item.href, { title: item.title, posterUrl: item.posterUrl, subtitle: item.subtitle })}
              className="relative isolate flex flex-col gap-1"
            >
              <div className="relative rounded-lg">
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-lg object-cover" />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                )}
                {partly && <StatusBadge kind="watched" progress={item.progress} maxSize={RING_MAX} className={`absolute ${corner}`} />}
                {!partly && item.watched && <StatusBadge kind="watched" maxSize={28} className={`absolute ${corner}`} />}
                {/* The ring wins when a show is both partly watched and on the watchlist. */}
                {!partly && !item.watched && wanted.has(wantedKeyOf(item.href) ?? "") && <StatusBadge kind="watchlist" maxSize={28} className={`absolute ${corner}`} />}
              </div>
              {/* The year sits straight under the title, one line or two; the box keeps one fixed height so every row is the same height before and after its pictures load. */}
              <span className="flex h-12 flex-col">
                <span className="line-clamp-2 text-xs font-medium leading-4">{item.title}</span>
                <span className="text-xs leading-4 text-neutral-500">{item.subtitle}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
