// components/SeasonTiles.tsx
// A show's seasons as a row of posters with how much of each you have watched. Each opens that season's page.
"use client";

import Link from "next/link";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { progressOf, type Cover } from "@/lib/domain/tv";
import type { ShowData } from "@/lib/logShow";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  data: ShowData;
  covers: Cover[];
  /** Where a season opens: your log's page for it, or the catalogue's when the show has no viewings yet. */
  hrefFor: (season: number) => string;
}

export default function SeasonTiles({ data, covers, hrefFor }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-lg">Seasons</h2>
      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
        {data.seasons.map((season) => {
          const info = data.status.seasons.find((s) => s.season === season.season);
          const poster = tmdbImageUrl(info?.posterPath ?? season.posterPath, "w185");
          const p = progressOf(covers, season.episodes.map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate })), today());
          return (
            <li key={season.season} className="w-28 shrink-0">
              <Link href={hrefFor(season.season)} className="flex flex-col gap-1">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
                ) : (
                  <span className="aspect-[2/3] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                )}
                <span className="text-sm font-medium">Season {season.season}</span>
                <span className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <span className="block h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: p.aired > 0 ? `${(p.watched / p.aired) * 100}%` : "0%" }} />
                </span>
                <span className="text-xs text-neutral-500">{p.aired > 0 ? `${p.watched}/${p.aired}` : "Not aired yet"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
