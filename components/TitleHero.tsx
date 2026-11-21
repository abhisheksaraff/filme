// components/TitleHero.tsx
// The top of a title page: the cover fading into the page, with the poster half over its edge.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  /** Makes the title a link, such as from a viewing back to its movie. */
  titleHref?: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
  /** Year, runtime and kind, shown under the title. */
  subtitle: string;
  loading?: boolean;
  /** Shown under the subtitle, such as the IMDb link and ratings. */
  extra?: ReactNode;
  /** Make the cover and poster open a viewer of every picture for the title. */
  onCoverClick?: () => void;
  onPosterClick?: () => void;
  /** Sits on the poster's top-right corner, such as the eye or progress ring. */
  posterBadge?: ReactNode;
}

export default function TitleHero({ backdropUrl, posterUrl, title, subtitle, loading, titleHref, extra, onCoverClick, onPosterClick, posterBadge }: Props) {
  return (
    <header>
      <div
        className="relative h-56 w-full overflow-hidden md:h-72 lg:h-80 bg-neutral-300 dark:bg-neutral-800"
        {...(onCoverClick ? { role: "button", tabIndex: 0, "aria-label": "See all covers", onClick: onCoverClick, onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && onCoverClick() } : {})}
      >
        {backdropUrl && (
          // The wrapper carries the settle animation.
          <div className="settle h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backdropUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {/* Fades the cover into the page colour so the poster sits on a soft edge. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--background)] to-transparent" />
        {loading && <div className="skeleton absolute inset-0" />}
      </div>

      <div className="relative z-10 -mt-20 flex items-end gap-4 px-5 md:-mt-24 md:gap-6 lg:-mt-28">
        {(() => {
          const poster = posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" className="aspect-[2/3] w-28 shrink-0 rounded-xl border-2 border-white object-cover shadow-md md:w-36 lg:w-44 dark:border-neutral-950" />
          ) : (
            <div className="aspect-[2/3] w-28 shrink-0 rounded-xl border-2 border-white bg-neutral-200 md:w-36 lg:w-44 dark:border-neutral-950 dark:bg-neutral-800" />
          );
          const shown = onPosterClick ? <button type="button" aria-label="See all posters" onClick={onPosterClick} className="block shrink-0">{poster}</button> : poster;
          return posterBadge ? <div className="relative shrink-0">{shown}{posterBadge}</div> : shown;
        })()}
        <div className="flex min-w-0 flex-col gap-1 pb-1">
          <h1 className="font-serif text-2xl leading-tight tracking-tight md:text-3xl lg:text-4xl">{titleHref ? <Link href={titleHref}>{title}</Link> : title}</h1>
          <span className="text-sm text-neutral-500 md:text-base">{subtitle}</span>
          {extra && <div className="rise">{extra}</div>}
        </div>
      </div>
    </header>
  );
}
