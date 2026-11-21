// components/SeasonTiles.tsx
// A show's seasons as a row of posters with how much of each you have watched. Each opens that season's page.
"use client";

import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { progressOf, type Cover } from "@/lib/domain/tv";
import type { ShowData } from "@/lib/logShow";

const today = () => new Date().toISOString().slice(0, 10);

/** How much of a season is watched, in words: "22 episodes", "7 of 22 watched", "All 22 watched", or "Not aired yet". */
function progressText(watched: number, aired: number): string {
  if (aired === 0) return "Not aired yet";
  if (watched === 0) return `${aired} ${aired === 1 ? "episode" : "episodes"}`;
  if (watched >= aired) return aired === 1 ? "Watched" : `All ${aired} watched`;
  return `${watched} of ${aired} watched`;
}

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
          const full = p.aired > 0 && p.watched >= p.aired;
          return (
            <li key={season.season} className="w-28 shrink-0 md:w-36 lg:w-40">
              <Link href={hrefFor(season.season)} className="flex flex-col gap-1">
                <span className="relative block">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
                  ) : (
                    <span className="block aspect-[2/3] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  {/* A season you have watched all of gets the eye in place of a bar. */}
                  {full && <StatusBadge kind="watched" maxSize={28} className="absolute right-[4%] top-[3%]" />}
                </span>
                <span className="font-serif text-base font-medium leading-tight">Season {season.season}</span>
                <span className={`h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800 ${full ? "invisible" : ""}`}>
                  <span className="block h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: p.aired > 0 ? `${(p.watched / p.aired) * 100}%` : "0%" }} />
                </span>
                <span className="font-serif text-sm leading-tight text-neutral-500">{progressText(p.watched, p.aired)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
