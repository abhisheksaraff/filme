// app/want/page.tsx
// Your watchlist, with theatre alerts, release reminders and new episodes of shows you follow.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CatalogHit, ShowStatus } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import { buildIcs, downloadText } from "@/lib/ics";
import { previewHref } from "@/lib/home/rows";
import { withShow } from "@/lib/domain/tv";
import { services } from "@/lib/services";

interface FollowedShow {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  status: ShowStatus;
  /** The latest episode aired within the last two weeks. */
  fresh: boolean;
}

const RECENT_DAYS = 14;
const MAX_SHOWS = 12;

export default function WantPage() {
  const ready = useRequireSession();
  const [wanted, setWanted] = useState<WantedItem[] | null>(null);
  const [now, setNow] = useState<CatalogHit[]>([]);
  const [soon, setSoon] = useState<CatalogHit[]>([]);
  const [shows, setShows] = useState<FollowedShow[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const [list, location, seen] = await Promise.all([services.wanted.list(), services.settings.location(), services.log.seen()]);
      if (cancelled) return;
      if (list.ok) setWanted(list.value);
      else setProblem(list.error);

      // Theatre listings are for the user's country; Canada until their location is known.
      const region = (location.ok && location.value?.region) || "CA";
      const [nowRes, soonRes] = await Promise.all([services.catalog.theatres("now", region), services.catalog.theatres("soon", region)]);
      if (cancelled) return;
      if (nowRes.ok) setNow(nowRes.value);
      if (soonRes.ok) setSoon(soonRes.value);

      const ids = seen.ok ? seen.value.filter((k) => k.startsWith("TV Show:")).map((k) => Number(k.split(":")[1])).slice(0, MAX_SHOWS) : [];
      const followed = await Promise.all(
        ids.map(async (tmdbId): Promise<FollowedShow | null> => {
          const [status, info] = await Promise.all([services.catalog.showStatus(tmdbId), services.catalog.details({ kind: "TV Show", tmdbId })]);
          if (!status.ok || !info.ok) return null;
          const aired = status.value.last?.airDate;
          return {
            tmdbId,
            title: info.value.title,
            posterUrl: tmdbImageUrl(info.value.posterPath, "w185"),
            status: status.value,
            fresh: !!aired && (Date.now() - new Date(aired).getTime()) / 86_400_000 <= RECENT_DAYS,
          };
        }),
      );
      if (!cancelled) setShows(followed.filter((s): s is FollowedShow => s !== null));
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  const wantedIds = new Set((wanted ?? []).flatMap((w) => (w.tmdbId === null ? [] : [`${w.category}:${w.tmdbId}`])));
  const inTheatres = now.filter((hit) => wantedIds.has(`Movie:${hit.tmdbId}`));
  const opening = soon.filter((hit) => wantedIds.has(`Movie:${hit.tmdbId}`) && hit.releaseDate);
  const fresh = shows.filter((s) => s.fresh);
  const upcoming = shows.filter((s) => s.status.next?.airDate);

  function remindOpening() {
    downloadText(
      "filme-opening-soon.ics",
      buildIcs("Opening soon", opening.map((hit) => ({ uid: `open-${hit.tmdbId}`, title: `${hit.title} opens`, date: (hit.releaseDate as string).slice(0, 10) }))),
    );
  }

  function remindEpisodes() {
    downloadText(
      "filme-new-episodes.ics",
      buildIcs(
        "New episodes",
        upcoming.map((s) => ({
          uid: `ep-${s.tmdbId}-${s.status.next?.season}-${s.status.next?.episode}`,
          title: `${s.title} S${s.status.next?.season}E${s.status.next?.episode}`,
          date: (s.status.next?.airDate as string).slice(0, 10),
        })),
      ),
    );
  }

  const card = "flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900";

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-4 pt-6">
      <h1 className="font-serif text-3xl tracking-tight">Watchlist</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {inTheatres.length > 0 && (
        <section className={card}>
          <h2 className="font-serif text-lg">In theatres now</h2>
          <p className="text-neutral-500">Titles on your list that are showing near you.</p>
          <ul className="flex flex-col gap-1">
            {inTheatres.map((hit) => (
              <li key={hit.tmdbId}><Link href={previewHref("Movie", hit.tmdbId)} className="font-medium">{hit.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {opening.length > 0 && (
        <section className={card}>
          <h2 className="font-serif text-lg">Opening soon</h2>
          <ul className="flex flex-col gap-1">
            {opening.map((hit) => (
              <li key={hit.tmdbId} className="flex justify-between gap-2">
                <Link href={previewHref("Movie", hit.tmdbId)} className="font-medium">{hit.title}</Link>
                <span className="text-neutral-500">{hit.releaseDate?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
          <RoundButton icon="calendarPlus" label="Add to calendar" tone="dark" onClick={remindOpening} className="self-start" />
        </section>
      )}

      {(fresh.length > 0 || upcoming.length > 0) && (
        <section className={card}>
          <h2 className="font-serif text-lg">Up next</h2>
          <ul className="flex flex-col gap-2">
            {fresh.map((s) => (
              <li key={`new-${s.tmdbId}`}>
                <Link href={previewHref("TV Show", s.tmdbId)} className="font-medium">{s.title}</Link>
                <span className="block text-neutral-500">New: S{s.status.last?.season}E{s.status.last?.episode} aired {s.status.last?.airDate}</span>
              </li>
            ))}
            {upcoming.map((s) => (
              <li key={`next-${s.tmdbId}`}>
                <Link href={previewHref("TV Show", s.tmdbId)} className="font-medium">{s.title}</Link>
                <span className="block text-neutral-500">Next: S{s.status.next?.season}E{s.status.next?.episode} on {s.status.next?.airDate}</span>
              </li>
            ))}
          </ul>
          {upcoming.length > 0 && <RoundButton icon="calendarPlus" label="Add to calendar" tone="dark" onClick={remindEpisodes} className="self-start" />}
        </section>
      )}

      {!wanted && <div className="skeleton h-40 rounded-2xl" />}
      {wanted?.length === 0 && <p className="text-sm text-neutral-500">Nothing here yet.</p>}
      <ul className="grid grid-cols-2 gap-4">
        {wanted?.map((item) => {
          const poster = tmdbImageUrl(item.posterPath, "w342");
          return (
            <li key={`${item.mediaId}:${item.season ?? ""}:${item.episode ?? ""}`} className="flex flex-col gap-2">
              <Link
                href={
                  item.episode !== null
                    ? `/episode/?id=${item.mediaId}&s=${item.season ?? 1}&e=${item.episode}`
                    : item.season !== null
                      ? `/season/?id=${item.mediaId}&n=${item.season}`
                      : item.tmdbId !== null && (item.category === "Movie" || item.category === "TV Show")
                        ? previewHref(item.category, item.tmdbId)
                        : `/title/?id=${item.mediaId}`
                }
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
                )}
                <span className="mt-1 block font-serif text-base leading-tight">{withShow(item.title, item.season, item.episode)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
