// components/TitleHero.tsx
// The top of a title page: the cover fading into the page, with the poster half over its edge.
"use client";

import Link from "next/link";

interface Props {
  /** Makes the title a link, such as from a viewing back to its movie. */
  titleHref?: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
  /** Year, runtime and kind, shown under the title. */
  subtitle: string;
  loading?: boolean;
}

export default function TitleHero({ backdropUrl, posterUrl, title, subtitle, loading, titleHref }: Props) {
  return (
    <header>
      <div className="relative h-56 w-full overflow-hidden bg-neutral-300 dark:bg-neutral-800">
        {backdropUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdropUrl} alt="" className="h-full w-full object-cover" />
        )}
        {/* Fades the cover into the page colour so the poster sits on a soft edge. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--background)] to-transparent" />
        {loading && <div className="skeleton absolute inset-0" />}
      </div>

      <div className="relative z-10 -mt-20 flex items-end gap-4 px-5">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" className="aspect-[2/3] w-28 shrink-0 rounded-xl border-2 border-white object-cover shadow-md dark:border-neutral-950" />
        ) : (
          <div className="aspect-[2/3] w-28 shrink-0 rounded-xl border-2 border-white bg-neutral-200 dark:border-neutral-950 dark:bg-neutral-800" />
        )}
        <div className="flex min-w-0 flex-col gap-1 pb-1">
          <h1 className="font-serif text-2xl leading-tight tracking-tight">{titleHref ? <Link href={titleHref}>{title}</Link> : title}</h1>
          <span className="text-sm text-neutral-500">{subtitle}</span>
        </div>
      </div>
    </header>
  );
}
