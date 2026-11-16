// app/watchlist/page.tsx
// Entry point for logging a viewing, with the most recent ones listed below.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { toast } from "@/components/Toast";
import { useEffect, useState } from "react";
import WatchedCard from "@/components/WatchedCard";
import Icon from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import ScopeSearchButton from "@/components/ScopeSearchButton";
import SortButton from "@/components/SortButton";
import { LIST_SORTS, sortList, type ListSort } from "@/lib/domain/listSort";
import { scoreKey } from "@/lib/ports/ratings";
import { usePageState } from "@/lib/pageMemory";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { DeletedEntry, RecentEntry } from "@/lib/ports/log";
import { services } from "@/lib/services";

export default function WatchlistPage() {
  const ready = useRequireSession();
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [deleted, setDeleted] = useState<DeletedEntry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sort, setSort] = usePageState<ListSort>("watched.sort", "new");
  // IMDb scores by title (the catalogue's when there is none), looked up in the background for titles without one.
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.log.recent(60), services.log.deleted(10)]).then(([recentRes, deletedRes]) => {
      if (cancelled) return;
      if (recentRes.ok) {
        setRecent(recentRes.value);
        const items = recentRes.value.filter((r) => r.tmdbId !== null && (r.category === "Movie" || r.category === "TV Show")).map((r) => ({ mediaId: r.mediaId, kind: r.category as "Movie" | "TV Show", tmdbId: r.tmdbId, tmdbRating: r.score, releaseDate: r.releaseDate }));
        void services.ratings.scores(items, { fill: 12, onScore: (key, score) => !cancelled && setScores((m) => new Map(m).set(key, score)) }).then((m) => !cancelled && setScores((now) => new Map([...m, ...now])));
      } else setProblem(recentRes.error);
      if (deletedRes.ok) setDeleted(deletedRes.value);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  async function restore(id: string) {
    const res = await services.log.restoreViewing(id);
    if (res.ok) {
      setReload((n) => n + 1);
      toast("Viewing restored");
    } else setProblem(res.error);
  }

  if (!ready) return null;

  // Newest and oldest go by the day watched (a month or a year alone counts from its start); the rest by score or release date.
  const ordered = sortList(recent, sort, {
    date: (r) => r.watchedOn,
    score: (r) => scores.get(scoreKey({ mediaId: r.mediaId, kind: r.category as "Movie", tmdbId: r.tmdbId })) ?? r.score,
    release: (r) => r.releaseDate,
  });

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl tracking-tight">Watched</h1>
        <span className="flex items-center gap-2">
          <ScopeSearchButton scope="watched" />
          <SortButton value={sort} options={LIST_SORTS} onChange={setSort} />
        </span>
      </div>

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      <ul className="flex flex-col gap-5 md:grid md:grid-cols-2 md:items-start lg:grid-cols-3">
        {ordered.map((entry, i) => <WatchedCard key={entry.id} entry={entry} index={i} rating={entry.rating} notes={entry.notes} />)}
        {recent.length === 0 && !problem && <li className="text-sm text-neutral-500">Nothing logged yet.</li>}
      </ul>

      {deleted.length > 0 && (
        <section className="mt-10 flex flex-col gap-2">
          <button type="button" aria-expanded={showDeleted} onClick={() => setShowDeleted((o) => !o)} className="flex items-center justify-between text-left">
            <h2 className="font-serif text-xl">Recently deleted</h2>
            <Icon name={showDeleted ? "minus" : "plus"} size={18} />
          </button>
          {showDeleted && (
            <>
              <p className="text-xs text-neutral-500">Kept for 24 hours.</p>
              <ul className="flex flex-col gap-2">
                {deleted.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{entry.title} · deleted {entry.deletedAt.slice(0, 10)}</span>
                    <RoundButton icon="undo" label="Restore" size="sm" onClick={() => restore(entry.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

    </main>
  );
}
