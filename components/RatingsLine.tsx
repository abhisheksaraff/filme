// components/RatingsLine.tsx
// Under a title: a plain-text IMDb link, then IMDb's rating and your own.
import Icon from "@/components/Icon";
import type { TitleLinks } from "@/lib/ports/ratings";

interface Props {
  links: TitleLinks | null;
  /** Your rating from your latest rated viewing; null before you have logged one. */
  mine: number | null;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function RatingsLine({ links, mine }: Props) {
  const shown = links?.imdbRating ?? null;
  // Only IMDb's rating and yours are shown; TMDB's score is never a stand-in.
  const hasRatings = shown !== null || mine !== null;

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
      {/* Dark text with a share arrow so it reads as a link; grey and inert when there is no IMDb page. */}
      {links?.imdbId ? (
        <a href={`https://www.imdb.com/title/${links.imdbId}/`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-neutral-950 dark:text-white">
          IMDb<Icon name="open" size={14} />
        </a>
      ) : (
        <span aria-disabled="true" title="No IMDb page for this title" className="flex items-center gap-1 text-neutral-400 dark:text-neutral-600">
          IMDb<Icon name="open" size={14} />
        </span>
      )}
      {hasRatings && (
        <span className="flex gap-3 text-neutral-500">
          {shown !== null && <span>★ {num(shown)}</span>}
          {mine !== null && <span>★ {num(mine)} yours</span>}
        </span>
      )}
    </p>
  );
}
