// components/RatingsLine.tsx
// Under a title: a plain-text IMDb link, then IMDb's rating.
import Icon from "@/components/Icon";
import { formatScore } from "@/lib/domain/score";
import type { TitleLinks } from "@/lib/ports/ratings";

interface Props {
  links: TitleLinks | null;
}

const num = formatScore;

export default function RatingsLine({ links }: Props) {
  const shown = links?.imdbRating ?? null;
  // Only IMDb's rating is shown; TMDB's score is never a stand-in, and your own rating is never shown.

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
      {shown !== null && <span className="text-xs text-neutral-400">★ {num(shown)}</span>}
    </p>
  );
}
