// components/ShowSection.tsx
// A show's page body: progress, what to watch next (with a New tag), its seasons, and following for new episodes.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { isFollowing, isNewSince, progressOf, watchedWithinYear, type Cover, type EpisodeKey } from "@/lib/domain/tv";
import type { ShowData } from "@/lib/logShow";
import type { FollowMode } from "@/lib/ports/follows";
import { services } from "@/lib/services";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  mediaId: string;
  data: ShowData | null;
  covers: Cover[];
}

export default function ShowSection({ mediaId, data, covers }: Props) {
  const [mode, setMode] = useState<FollowMode | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    services.follows.mode(mediaId).then((res) => !cancelled && res.ok && setMode(res.value));
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  if (!data) return <div className="skeleton h-32 rounded-2xl" />;

  const keys: EpisodeKey[] = data.seasons.flatMap((s) => s.episodes.map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate })));
  const progress = progressOf(covers, keys, today());
  const nextEp = progress.next ? data.seasons.flatMap((s) => s.episodes).find((e) => e.season === progress.next?.season && e.episode === progress.next?.episode) : null;
  const upcoming = data.status.next;
  const recent = watchedWithinYear(covers, new Date());
  const following = isFollowing({ mode: mode ?? null, recent, running: data.status.running });

  async function toggleFollow() {
    const next: FollowMode = following ? "off" : "on";
    setMode(next);
    const res = await services.follows.set(mediaId, next);
    if (!res.ok) {
      setMode(mode);
      return toast(res.error);
    }
    toast(next === "on" ? "Following for new episodes" : "Unfollowed");
  }

  return (
    <div className="flex flex-col gap-4">
      {progress.aired > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>{progress.watched} of {progress.aired} episodes watched</span>
            <button type="button" onClick={toggleFollow} aria-pressed={following} className={`rounded-full border px-3 py-1 text-xs ${following ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-300 dark:border-neutral-700"}`}>
              {following ? "Following" : "Follow"}
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: `${(progress.watched / progress.aired) * 100}%` }} />
          </div>
        </div>
      )}

      {progress.next && (
        <Link href={`/episode/?id=${mediaId}&s=${progress.next.season}&e=${progress.next.episode}`} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900">
          {nextEp?.stillPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tmdbImageUrl(nextEp.stillPath, "w342") ?? ""} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="aspect-video w-28 shrink-0 rounded-lg bg-neutral-300 dark:bg-neutral-700" />
          )}
          <span className="flex min-w-0 flex-col gap-0.5 text-sm">
            <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
              {covers.length === 0 ? "Start with" : "Next up"}
              {isNewSince(progress.next.airDate, covers) && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white">New</span>}
            </span>
            <span className="font-serif text-base leading-tight">S{progress.next.season} E{progress.next.episode}{nextEp?.name ? ` · ${nextEp.name}` : ""}</span>
            {progress.next.airDate && <span className="text-neutral-500">Aired {progress.next.airDate}</span>}
          </span>
        </Link>
      )}

      {!progress.next && upcoming && (
        <p className="rounded-2xl bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          You are up to date. Next: S{upcoming.season} E{upcoming.episode}{upcoming.name ? ` · ${upcoming.name}` : ""}{upcoming.airDate ? `, airs ${upcoming.airDate}` : ""}.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg">Seasons</h2>
        <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
          {data.seasons.map((season) => {
            const info = data.status.seasons.find((s) => s.season === season.season);
            const poster = tmdbImageUrl(info?.posterPath ?? season.posterPath, "w185");
            const p = progressOf(covers, season.episodes.map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate })), today());
            return (
              <li key={season.season} className="w-28 shrink-0">
                <Link href={`/season/?id=${mediaId}&n=${season.season}`} className="flex flex-col gap-1">
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
    </div>
  );
}
