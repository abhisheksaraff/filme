// app/want/page.tsx
// Your watchlist, with theatre alerts and release reminders for the titles you added yourself.
"use client";

import PageHeader from "@/components/PageHeader";
import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useEffect, useState } from "react";
import RoundButton from "@/components/RoundButton";
import ScopeSearchButton from "@/components/ScopeSearchButton";
import SortButton from "@/components/SortButton";
import { LIST_SORTS, sortList, type ListSort } from "@/lib/domain/listSort";
import { scoreKey } from "@/lib/ports/ratings";
import { usePageState } from "@/lib/pageMemory";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CatalogHit } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import { buildIcs, downloadText } from "@/lib/ics";
import { previewHref } from "@/lib/home/rows";
import { withShow } from "@/lib/domain/tv";
import { services } from "@/lib/services";
import { formatScore } from "@/lib/domain/score";

export default function WantPage() {
  const ready = useRequireSession();
  const [wanted, setWanted] = useState<WantedItem[] | null>(null);
  const [now, setNow] = useState<CatalogHit[]>([]);
  const [soon, setSoon] = useState<CatalogHit[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [sort, setSort] = usePageState<ListSort>("want.sort", "new");
  // IMDb scores by title (the catalogue's when there is none), looked up in the background for titles without one.
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const [list, location, saved] = await Promise.all([services.wanted.list(), services.settings.location(), services.wanted.collections()]);
      if (cancelled) return;
      if (list.ok) {
        // A saved collection is one entry with its own poster; it follows the titles in the list.
        const collections = (saved.ok ? saved.value : []).map((c): WantedItem => ({ mediaId: `collection:${c.collectionId}`, tmdbId: null, category: "Collection", title: c.name, posterPath: c.posterPath, releaseDate: null, season: null, episode: null }));
        setWanted([...list.value, ...collections]);
        const items = list.value.filter((w) => w.category === "Movie" || w.category === "TV Show").map((w) => ({ mediaId: w.mediaId, kind: w.category as "Movie" | "TV Show", tmdbId: w.tmdbId, releaseDate: w.releaseDate }));
        void services.ratings.scores(items, { fill: 20, onScore: (key, score) => !cancelled && setScores((m) => new Map(m).set(key, score)) }).then((m) => !cancelled && setScores((now) => new Map([...m, ...now])));
      } else setProblem(list.error);

      // Theatre listings are for the user's country; Canada until their location is known.
      const region = (location.ok && location.value?.region) || "CA";
      const [nowRes, soonRes] = await Promise.all([services.catalog.theatres("now", region), services.catalog.theatres("soon", region)]);
      if (cancelled) return;
      if (nowRes.ok) setNow(nowRes.value);
      if (soonRes.ok) setSoon(soonRes.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  // The list arrives newest-added first, so the position stands in for the date added. Titles missing a score or release date go last.
  const shownWanted = sortList(wanted ?? [], sort, {
    date: (_w, i) => String(1_000_000 - i).padStart(7, "0"),
    score: (w) => scores.get(scoreKey({ mediaId: w.mediaId, kind: w.category as "Movie", tmdbId: w.tmdbId })) ?? null,
    release: (w) => w.releaseDate,
  });

  const wantedIds = new Set((wanted ?? []).flatMap((w) => (w.tmdbId === null ? [] : [`${w.category}:${w.tmdbId}`])));
  const inTheatres = now.filter((hit) => wantedIds.has(`Movie:${hit.tmdbId}`));
  const opening = soon.filter((hit) => wantedIds.has(`Movie:${hit.tmdbId}`) && hit.releaseDate);
  function remindOpening() {
    downloadText(
      "filme-opening-soon.ics",
      buildIcs("Opening soon", opening.map((hit) => ({ uid: `open-${hit.tmdbId}`, title: `${hit.title} opens`, date: (hit.releaseDate as string).slice(0, 10) }))),
    );
  }

  const card = "flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900";

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl wide:max-w-[min(94vw,88rem)] flex-col gap-5 px-5 pb-4 pt-6 wide:pt-0">
      <PageHeader title="Watchlist" inset="wide:pl-[3.25rem]">
        <ScopeSearchButton scope="watchlist" />
        <SortButton value={sort} options={LIST_SORTS} onChange={setSort} />
      </PageHeader>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

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

      {!wanted && <div className="skeleton h-40 rounded-2xl" />}
      {wanted?.length === 0 && <p className="text-sm text-neutral-500">Nothing here yet.</p>}
      <ul className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-7">
        {wanted && shownWanted.map((item) => {
          const poster = tmdbImageUrl(item.posterPath, "w342");
          return (
            <li key={`${item.mediaId}:${item.season ?? ""}:${item.episode ?? ""}`} className="flex flex-col gap-1">
              <Link
                href={
                  item.category === "Collection"
                    ? `/collection/?id=${item.mediaId.slice("collection:".length)}`
                    : item.episode !== null
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
                  <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover shadow-[0_5px_12px_-5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.14)]" />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-lg bg-neutral-200 shadow-[0_5px_12px_-5px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.14)] dark:bg-neutral-800" />
                )}
                <span className="mt-1 line-clamp-2 block text-xs font-medium leading-4">{withShow(item.title, item.season, item.episode)}</span>
                {/* Year · type · ★ score; whatever is not known is left out, with no empty space. */}
                {(() => {
                  const score = scores.get(scoreKey({ mediaId: item.mediaId, kind: item.category as "Movie", tmdbId: item.tmdbId }));
                  const line = [item.releaseDate?.slice(0, 4), item.category, score ? `★ ${formatScore(score)}` : null].filter(Boolean).join(" · ");
                  return line ? <span className="block whitespace-nowrap text-[10px] leading-4 tracking-tight text-neutral-400">{line}</span> : null;
                })()}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
