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
import { ConfirmPopup } from "@/components/Popup";
import StackCard, { type LoadedCard } from "@/components/StackCard";
import { loadStacks } from "@/lib/showStacks";
import { loadCollection } from "@/lib/collections";
import { findStack } from "@/lib/showPasses";
import type { StackNode } from "@/lib/domain/passes";
import type { Completion, StackEdit } from "@/lib/ports/passes";
import type { CollectionViewing } from "@/lib/ports/log";

/** A stored completion card with what its first paint needs. */
interface WatchedStack {
  completion: Completion;
  node: StackNode;
  viewings: Map<string, CollectionViewing>;
  edits: StackEdit[];
  date: string | null;
}

export default function WatchlistPage() {
  const ready = useRequireSession();
  // null until the list has really arrived, so "nothing logged" is only ever said when it is true.
  const [recent, setRecent] = useState<RecentEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleted, setDeleted] = useState<DeletedEntry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sort, setSort] = usePageState<ListSort>("watched.sort", "new");
  // IMDb scores by title (the catalogue's when there is none), looked up in the background for titles without one.
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  // Seasons, series and collections finished, stored, so they are in place from the first paint.
  const [stored, setStored] = useState<WatchedStack[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const [rows, edits] = await Promise.all([services.passes.completions(), services.passes.allEdits()]);
      if (cancelled || !rows.ok) return;
      const cards = rows.value.filter((c) => c.lastViewingId);
      const views = await services.log.viewingsByIds([...new Set(cards.map((c) => c.lastViewingId as string))]);
      if (cancelled || !views.ok) return;
      const byId = new Map(views.value.map((v) => [v.id, v] as const));
      const out: WatchedStack[] = [];
      for (const c of cards) {
        const last = byId.get(c.lastViewingId as string);
        if (!last) continue;
        const node: StackNode = {
          id: `${c.collectionId ?? c.mediaId}-${c.passKey}`,
          season: c.season,
          passKey: c.passKey,
          last: { viewingId: last.id, scope: "episode", season: c.season ?? 1, episode: 0, date: c.completedOn, addedAt: last.addedAt },
          items: [],
          editable: true,
        };
        const mine = (edits.ok ? edits.value : []).filter((e) => (c.collectionId !== null ? e.collectionId === c.collectionId : e.mediaId === c.mediaId));
        out.push({ completion: c, node, viewings: new Map([[last.id, last]]), edits: mine, date: c.completedOn });
      }
      if (!cancelled) setStored(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  /** A card's episodes or films, fetched when it is opened. */
  async function loadItems(card: WatchedStack): Promise<LoadedCard | null> {
    const c = card.completion;
    if (c.collectionId !== null) {
      const res = await loadCollection(c.collectionId);
      if (!res.ok) return null;
      const node = findStack(res.value.stacks, c.season, c.passKey);
      return node ? { node, viewings: new Map(res.value.viewings.map((v) => [v.id, v] as const)), edits: res.value.edits } : null;
    }
    if (!c.mediaId) return null;
    const res = await loadStacks(c.mediaId);
    const node = res ? findStack(res.stacks, c.season, c.passKey) : null;
    return res && node ? { node, viewings: res.viewings, edits: res.edits } : null;
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.log.recent(60), services.log.deleted(10)]).then(([recentRes, deletedRes]) => {
      if (cancelled) return;
      if (recentRes.ok) {
        setRecent(recentRes.value);
        const items = recentRes.value.filter((r) => r.tmdbId !== null && (r.category === "Movie" || r.category === "TV Show")).map((r) => ({ mediaId: r.mediaId, kind: r.category as "Movie" | "TV Show", tmdbId: r.tmdbId, tmdbRating: r.score, releaseDate: r.releaseDate }));
        void services.ratings.scores(items, { fill: 12, onScore: (key, score) => !cancelled && setScores((m) => new Map(m).set(key, score)) }).then((m) => !cancelled && setScores((now) => new Map([...m, ...now])));
      } else setFailed(true);
      if (deletedRes.ok) setDeleted(deletedRes.value);
    }).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  // Both ask first: what is asked about (and which way) is held here until the pop-up is answered.
  const [asking, setAsking] = useState<{ id: string; title: string; action: "restore" | "remove" } | null>(null);
  const [working, setWorking] = useState(false);

  async function confirmAsking() {
    if (!asking) return;
    setWorking(true);
    const res = asking.action === "restore" ? await services.log.restoreViewing(asking.id) : await services.log.deleteViewingNow(asking.id);
    setWorking(false);
    setAsking(null);
    if (!res.ok) return setProblem(res.error);
    setReload((n) => n + 1);
    toast(asking.action === "restore" ? "Viewing restored" : "Deleted for good");
  }

  if (!ready) return null;

  // Newest and oldest go by the day watched (a month or a year alone counts from its start); the rest by score or release date.
  const ordered = sortList(recent ?? [], sort, {
    date: (r) => r.watchedOn,
    score: (r) => scores.get(scoreKey({ mediaId: r.mediaId, kind: r.category as "Movie", tmdbId: r.tmdbId })) ?? r.score,
    release: (r) => r.releaseDate,
  });

  // Completion cards sit among the viewings by the day they were completed; under a sort that is not by date they go last.
  type Item = { entry: RecentEntry } | { card: WatchedStack };
  const merged: Item[] = ordered.map((entry) => ({ entry }));
  for (const card of stored) {
    const day = card.date ?? "";
    const at = sort === "new" ? merged.findIndex((m) => "entry" in m && (m.entry.watchedOn ?? "") <= day) : sort === "old" ? merged.findIndex((m) => "entry" in m && (m.entry.watchedOn ?? "") >= day) : -1;
    merged.splice(at < 0 ? merged.length : at, 0, { card });
  }

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
        {merged.map((item, i) => "card" in item ? (
          <StackCard key={item.card.node.id} node={item.card.node} viewings={item.card.viewings} edits={item.card.edits} showTitle index={i}
            completions={[item.card.completion]} collectionId={item.card.completion.collectionId ?? undefined}
            label={item.card.completion.collectionId !== null ? `${item.card.completion.collectionName ?? "Collection"} completed` : undefined}
            load={() => loadItems(item.card)}
            show={(() => { const v = item.card.viewings.get(item.card.node.last.viewingId); const coll = item.card.completion.collectionId !== null; return { mediaId: v?.mediaId ?? "", title: coll ? item.card.completion.collectionName ?? v?.title ?? "" : v?.title ?? "", category: coll ? "Movie" : "TV Show", posterPath: v?.posterPath ?? null }; })()} />
        ) : <WatchedCard key={item.entry.id} entry={item.entry} index={i} rating={scores.get(scoreKey({ mediaId: item.entry.mediaId, kind: item.entry.category as "Movie", tmdbId: item.entry.tmdbId })) ?? item.entry.score} notes={item.entry.notes} />)}
        {recent === null && !failed && Array.from({ length: 3 }, (_, i) => <li key={i} className="skeleton h-64 rounded-2xl" />)}
        {failed && <li className="text-sm text-neutral-500">We&apos;re having some trouble loading your viewings. Please check back later.</li>}
        {recent !== null && recent.length === 0 && <li className="text-sm text-neutral-500">Nothing logged yet.</li>}
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
                    <span className="flex gap-2">
                      <RoundButton icon="undo" label="Restore" size="sm" onClick={() => setAsking({ id: entry.id, title: entry.title, action: "restore" })} />
                      <RoundButton icon="trash" label="Delete now" size="sm" tone="danger" onClick={() => setAsking({ id: entry.id, title: entry.title, action: "remove" })} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {asking && (
        <ConfirmPopup
          title={asking.action === "restore" ? "Restore this viewing?" : "Delete for good?"}
          message={asking.action === "restore" ? `${asking.title} goes back to your Watched list.` : `${asking.title} is removed now, with its pictures, and cannot be restored. A venue only it used goes too.`}
          confirmLabel={asking.action === "restore" ? "Restore" : "Delete"}
          confirmIcon={asking.action === "restore" ? "undo" : "trash"}
          busy={working}
          onConfirm={() => void confirmAsking()}
          onCancel={() => setAsking(null)}
        />
      )}
    </main>
  );
}
