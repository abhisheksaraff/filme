// app/collection/page.tsx
// A movie collection (a trilogy or franchise): its films in release order with how many you have seen, your rewatch progress, and your viewings.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import ProblemPopup from "@/components/ProblemPopup";
import RewatchLine from "@/components/RewatchLine";
import StackCard, { cardOf } from "@/components/StackCard";
import StatusBadge from "@/components/StatusBadge";
import TitleHero from "@/components/TitleHero";
import WatchedCard from "@/components/WatchedCard";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { isOut, loadCollection, type CollectionData } from "@/lib/collections";
import { seenState } from "@/lib/domain/passes";
import type { Completion } from "@/lib/ports/passes";
import { services } from "@/lib/services";
import { previewHref } from "@/lib/home/rows";
import CollectionDoNotRecommend from "@/components/CollectionDoNotRecommend";
import DateField from "@/components/ui/DateField";
import Popup, { PopupAction } from "@/components/Popup";
import InfoCards, { timesText } from "@/components/InfoCards";
import PersonCircle from "@/components/PersonCircle";
import TitleActions from "@/components/TitleActions";
import WhenPopup from "@/components/WhenPopup";
import { toast } from "@/components/Toast";
import { logCollectionNow } from "@/lib/logCollection";
import { formatMoney, formatRuntime, loadCollectionInfo, type CollectionInfo, type CollectionPerson } from "@/lib/collectionInfo";

const today = () => new Date().toISOString().slice(0, 10);

/** "1962–2021": the first and latest release years of the films that have a date. */
function years(detail: { parts: { releaseDate: string | null }[] }): string {
  const ys = detail.parts.flatMap((p) => (p.releaseDate ? [p.releaseDate.slice(0, 4)] : []));
  if (ys.length === 0) return "";
  return ys[0] === ys[ys.length - 1] ? ys[0] : `${ys[0]}–${ys[ys.length - 1]}`;
}

function CollectionView() {
  const ready = useRequireSession();
  const id = Number(useSearchParams().get("id")) || null;
  const [data, setData] = useState<CollectionData | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [when, setWhen] = useState<"ask" | "date" | null>(null);
  const [day, setDay] = useState(today());
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<CollectionInfo | null>(null);
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (!ready || id === null) return;
    let cancelled = false;
    Promise.all([loadCollection(id), services.passes.completions(), services.wanted.collections()]).then(([res, comps, saved]) => {
      if (cancelled) return;
      if (saved.ok) setWanted(saved.value.some((c) => c.collectionId === id));
      if (res.ok) setData(res.value);
      else setProblem(res.error);
      if (comps.ok) setCompletions(comps.value.filter((c) => c.collectionId === id));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  // Genres, runtime, box office, cast and crew come from the films themselves, a few at a time, so the page does not wait for them.
  const detail = data?.detail ?? null;
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    loadCollectionInfo(detail).then((res) => !cancelled && setInfo(res));
    return () => {
      cancelled = true;
    };
  }, [detail]);

  async function toggleWanted() {
    if (!data) return;
    setBusy(true);
    const res = await services.wanted.setCollectionWanted({ collectionId: data.detail.id, name: data.detail.name, posterPath: data.detail.posterPath }, !wanted);
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    setWanted(!wanted);
    toast(wanted ? "Removed from watchlist" : "Added to watchlist");
  }

  const byTmdb = useMemo(() => new Map((data?.viewings ?? []).map((v) => [v.tmdbId, v] as const)), [data]);
  const byId = useMemo(() => new Map((data?.viewings ?? []).map((v) => [v.id, v] as const)), [data]);

  async function reset(): Promise<string | null> {
    if (id === null) return "No collection selected.";
    const res = await services.passes.reset({ collectionId: id }, 1);
    if (!res.ok) return res.error;
    setReload((n) => n + 1);
    return null;
  }

  /** One viewing for every film that is out, all on the same day (or undated). */
  async function logAll(date: string | null) {
    if (!data) return;
    setBusy(true);
    const res = await logCollectionNow(data.detail, date);
    setBusy(false);
    setWhen(null);
    if (!res.ok) return setProblem(res.error);
    toast(`Logged ${res.value} ${res.value === 1 ? "film" : "films"}`);
    setReload((n) => n + 1);
  }

  if (!ready) return null;
  if (id === null) return <main className="p-6 text-sm">No collection selected.</main>;
  const state = data ? seenState(data.passes) : null;
  const show = data ? { mediaId: data.viewings[0]?.mediaId ?? "", title: data.detail.name, category: "Movie", posterPath: data.detail.posterPath } : null;
  const rows = data
    ? [...data.viewings.map((v) => ({ v, date: v.watchedOn })), ...data.stacks.map((node) => ({ node, date: node.last.date }))].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    : [];

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5">
      <TitleHero
        backdropUrl={tmdbImageUrl(data?.detail.backdropPath, "w780")}
        posterUrl={tmdbImageUrl(data?.detail.posterPath, "w342")}
        title={data?.detail.name ?? ""}
        subtitle={data ? `${data.detail.parts.length} films` : ""}
        loading={!data && !problem}
      />
      <div className="flex flex-col gap-5 px-5 pb-8">
        <ProblemPopup message={problem} onClose={() => setProblem(null)} />
        {data && (
          <>
            <InfoCards cards={[
              { label: "Details", value: [years(data.detail), `${data.detail.parts.length} films`].filter(Boolean).join(" · ") },
              { label: "Genres", value: info?.genres.slice(0, 6).join(", ") },
              { label: "Runtime", value: info && info.runtime > 0 && formatRuntime(info.runtime) },
              { label: "Box office", value: info && info.revenue > 0 && formatMoney(info.revenue) },
              { label: "Watched", value: timesText(data.passes.passes.length) },
            ]} />
            {data.detail.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{data.detail.overview}</p>}
            <TitleActions wanted={wanted} watched={state?.kind === "eye"} progress={state?.kind === "ring" ? state.progress : undefined} canBookmark watch={null} busy={busy} onToggleWanted={() => void toggleWanted()} onLog={() => setWhen("ask")} />
            <RewatchLine passes={data.passes} onReset={reset} noun="film" />

            <section className="flex flex-col gap-2">
              <h2 className="font-serif text-lg">Films</h2>
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                {data.detail.parts.map((p) => {
                  const mine = byTmdb.get(p.tmdbId);
                  const poster = tmdbImageUrl(p.posterPath, "w185");
                  return (
                    <li key={p.tmdbId} className="w-28 shrink-0 md:w-36 lg:w-40">
                      <Link href={mine ? `/title/?id=${mine.mediaId}` : previewHref("Movie", p.tmdbId)} className="flex flex-col gap-1">
                        <span className="relative block">
                          {poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
                          ) : (
                            <span className="block aspect-[2/3] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                          )}
                          {mine && <StatusBadge kind="watched" maxSize={28} className="absolute right-[4%] top-[3%]" />}
                        </span>
                        <span className="font-serif text-sm leading-tight">{p.title}</span>
                        <span className="text-xs text-neutral-500">{isOut(p) ? p.releaseDate?.slice(0, 4) : p.releaseDate ? `Out ${p.releaseDate}` : "Not out yet"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {info && ([["Cast", info.cast], ["Director", info.directors], ["Writer", info.writers]] as [string, CollectionPerson[]][]).map(([group, people]) =>
              people.length === 0 ? null : (
                <section key={group} className="flex flex-col gap-2">
                  <h2 className="font-serif text-lg">{group}</h2>
                  <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                    {people.map((p) => <PersonCircle key={`${group}-${p.tmdbId}`} href={`/person/?tmdb=${p.tmdbId}`} name={p.name} profilePath={p.profilePath} note={`${p.films} ${p.films === 1 ? "film" : "films"}`} />)}
                  </ul>
                </section>
              ),
            )}

            {rows.length > 0 && show && (
              <section className="flex flex-col gap-3">
                <h2 className="font-serif text-xl">Your viewings</h2>
                <ul className="flex flex-col gap-5 md:grid md:grid-cols-2 md:items-start lg:grid-cols-3">
                  {rows.map((row, i) =>
                    "node" in row ? (
                      <StackCard key={row.node.id} node={row.node} viewings={byId} edits={data.edits} completions={completions} collectionId={data.detail.id}
                        label={`${data.detail.name} completed`} show={show} showTitle index={i} />
                    ) : (
                      <WatchedCard key={row.v.id} index={i} animate rating={row.v.rating} notes={row.v.notes} entry={cardOf(row.v, show)} />
                    ),
                  )}
                </ul>
              </section>
            )}
            <CollectionDoNotRecommend collectionId={data.detail.id} />
          </>
        )}
      </div>

      {when === "ask" && <WhenPopup what={data?.detail.name ?? "the collection"} busy={busy} onToday={() => void logAll(today())} onForm={() => setWhen("date")} onUndated={() => void logAll(null)} onClose={() => setWhen(null)} />}
      {when === "date" && (
        <Popup title="Which day?" onClose={() => !busy && setWhen(null)}
          actions={
            <>
              <PopupAction icon="close" label="Cancel" tone="cancel" disabled={busy} onClick={() => setWhen(null)} />
              <PopupAction icon="check" label="Log" disabled={busy || !day} onClick={() => void logAll(day)} />
            </>
          }>
          <DateField value={day} max={today()} onChange={setDay} label="Date" className="h-11 bg-white/10 text-white" hintClass="text-white/50" />
        </Popup>
      )}
    </main>
  );
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  );
}
