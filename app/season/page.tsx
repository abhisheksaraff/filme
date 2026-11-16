// app/season/page.tsx
// One season of a show: its episodes with progress, and the same bookmark, tick, Watch and + as the show.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Popup, { PopupAction } from "@/components/Popup";
import WhenPopup from "@/components/WhenPopup";
import { lastWatchedText, latestViewing } from "@/lib/domain/lastWatched";
import { toast } from "@/components/Toast";
import TitleActions from "@/components/TitleActions";
import TitleHero from "@/components/TitleHero";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { isCovered, progressOf, type Cover } from "@/lib/domain/tv";
import { startEntryFrom } from "@/lib/logPrefill";
import { logShowNow } from "@/lib/logShow";
import type { SeasonDetail } from "@/lib/ports/catalog";
import type { ViewingSummary } from "@/lib/ports/log";
import { services } from "@/lib/services";
import DateField from "@/components/ui/DateField";

const today = () => new Date().toISOString().slice(0, 10);
const ORDINAL = (n: number) => (n === 1 ? "First viewing" : `Rewatch #${n - 1}`);

function SeasonView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  // A show that is not in your log yet is opened by its TMDB id, so its seasons can still be browsed and logged.
  const tmdbParam = Number(params.get("tmdb")) || null;
  const n = Number(params.get("n"));

  /** The show as this page needs it: from your log, or from the catalogue when it has no viewings yet. */
  interface ShowInfo {
    mediaId: string | null;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    releaseDate: string | null;
    viewings: ViewingSummary[];
  }
  const [detail, setDetail] = useState<ShowInfo | null>(null);
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [wanted, setWanted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState(false);
  const [reload, setReload] = useState(0);
  // Picking several episodes to log together.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [pickWhen, setPickWhen] = useState<"ask" | "date" | null>(null);
  const [pickDate, setPickDate] = useState(today());

  useEffect(() => {
    if (!ready || (!id && !tmdbParam) || !Number.isInteger(n)) return;
    let cancelled = false;
    (async () => {
      let info: ShowInfo;
      if (id) {
        const res = await services.log.titleDetail(id);
        if (cancelled) return;
        if (!res.ok || res.value.tmdbId === null) return setProblem(res.ok ? "This show has no catalogue page." : res.error);
        info = { mediaId: res.value.mediaId, tmdbId: res.value.tmdbId, title: res.value.title, posterPath: res.value.posterPath, backdropPath: res.value.backdropPath, releaseDate: res.value.releaseDate, viewings: res.value.viewings };
      } else {
        const res = await services.catalog.details({ tmdbId: tmdbParam as number, kind: "TV Show" });
        if (cancelled) return;
        if (!res.ok) return setProblem(res.error);
        info = { mediaId: null, tmdbId: res.value.tmdbId, title: res.value.title, posterPath: res.value.posterPath, backdropPath: res.value.backdropPath, releaseDate: res.value.releaseDate, viewings: [] };
      }
      setDetail(info);
      const [s, w] = await Promise.all([
        services.catalog.season(info.tmdbId, n),
        services.wanted.status("TV Show", info.tmdbId, { season: n, episode: null }),
      ]);
      if (cancelled) return;
      if (s.ok) setSeason(s.value);
      else setProblem(s.error);
      if (w.ok) {
        setWanted(w.value.wanted);
        if (w.value.mediaId) setDetail((d) => (d && !d.mediaId ? { ...d, mediaId: w.value.mediaId } : d));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, tmdbParam, n, reload]);

  async function toggleWanted() {
    if (!detail?.tmdbId) return;
    setBusy(true);
    const scope = { season: n, episode: null };
    let res;
    if (wanted && detail.mediaId) res = await services.wanted.remove(detail.mediaId, scope);
    else {
      const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
      res = full.ok ? await services.wanted.add(full.value, scope) : full;
    }
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    setWanted(!wanted);
    toast(wanted ? "Removed from watchlist" : "Added to watchlist");
  }

  /** Where the page goes once something is logged for a show that had no viewings: the same season, now in your log. */
  function afterLog(mediaId: string) {
    if (id) setReload((k) => k + 1);
    else router.replace(`/season/?id=${mediaId}&n=${n}`);
  }

  async function logSeason(date: string | null) {
    if (!detail) return;
    setBusy(true);
    const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
    const res = full.ok ? await logShowNow(full.value, n, null, date) : full;
    setBusy(false);
    setWhen(false);
    if (!res.ok) return setProblem(res.error);
    toast(`Logged Season ${n}`);
    afterLog(res.value);
  }

  async function logPicked(date: string | null) {
    if (!detail || picked.size === 0) return;
    setBusy(true);
    const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
    if (!full.ok) {
      setBusy(false);
      return setProblem(full.error);
    }
    let mediaId: string | null = null;
    for (const e of [...picked].sort((a, b) => a - b)) {
      const res = await logShowNow(full.value, n, e, date);
      if (!res.ok) {
        setBusy(false);
        return setProblem(res.error);
      }
      mediaId = res.value;
    }
    setBusy(false);
    setPickWhen(null);
    setPicking(false);
    setPicked(new Set());
    toast(picked.size === 1 ? "Logged 1 episode" : `Logged ${picked.size} episodes`);
    if (mediaId) afterLog(mediaId);
  }

  function logWithForm(episode: number | null = null) {
    if (!detail) return;
    startEntryFrom({ category: "TV Show", title: detail.title, tmdbId: detail.tmdbId, season: n, episode });
    router.push("/scan/");
  }

  if (!ready) return null;
  if ((!id && !tmdbParam) || !Number.isInteger(n)) return <main className="p-6 text-sm">No season selected.</main>;

  const covers: Cover[] = (detail?.viewings ?? []).map((v) => ({ scope: v.scope, season: v.season, episode: v.episode, date: v.watchedOn }));
  const keys = (season?.episodes ?? []).map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate }));
  const progress = progressOf(covers, keys, today());
  // The latest viewing that included any of this season: the series, the season itself, or one of its episodes.
  const lastLine = lastWatchedText(latestViewing((detail?.viewings ?? []).filter((v) => v.scope === "show" || v.season === n)), true);
  const own = (detail?.viewings ?? []).filter((v) => v.scope === "season" && v.season === n);
  const oldestFirst = [...own].reverse();

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5">
      <TitleHero
        titleHref={id ? `/title/?id=${id}` : `/preview/?kind=tv&id=${tmdbParam}`}
        backdropUrl={tmdbImageUrl(detail?.backdropPath, "w780")}
        posterUrl={tmdbImageUrl(season?.posterPath ?? detail?.posterPath, "w342")}
        title={season?.name ?? `Season ${n}`}
        subtitle={detail ? [detail.title, season?.airDate?.slice(0, 4), season ? `${season.episodes.length} episodes` : null].filter(Boolean).join(" · ") : ""}
        loading={!detail && !problem}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        <ProblemPopup message={problem} onClose={() => setProblem(null)} />

        {detail && season && (
          <>
            <TitleActions
              wanted={wanted}
              canBookmark
              watch={{ tmdbId: detail.tmdbId, kind: "TV Show", title: detail.title, year: detail.releaseDate?.slice(0, 4) ?? null }}
              busy={busy}
              onToggleWanted={toggleWanted}
              onLog={() => setWhen(true)}
            />

            {season.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{season.overview}</p>}
            {lastLine && <p className="-mt-3 text-xs text-neutral-500">{lastLine}</p>}
            {progress.aired > 0 && <p className="text-sm">{progress.watched} of {progress.aired} episodes watched</p>}

            <div className="flex items-center justify-between text-sm">
              {picking ? (
                <>
                  <span className="text-neutral-500">{picked.size === 0 ? "Tap episodes to pick them" : `${picked.size} picked`}</span>
                  <span className="flex items-center gap-4">
                    {picked.size > 0 && <button type="button" onClick={() => setPickWhen("ask")} className="font-medium">Log</button>}
                    <button type="button" onClick={() => { setPicking(false); setPicked(new Set()); }} className="text-neutral-500">Cancel</button>
                  </span>
                </>
              ) : (
                <button type="button" onClick={() => setPicking(true)} className="font-medium">Select episodes</button>
              )}
            </div>

            <ul className="flex flex-col gap-2">
              {season.episodes.map((e) => {
                const unaired = !!e.airDate && e.airDate > today();
                const watched = isCovered(covers, { season: e.season, episode: e.episode, airDate: e.airDate });
                const still = tmdbImageUrl(e.stillPath, "w342");
                const on = picked.has(e.episode);
                const body = (
                  <>
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="aspect-video w-24 shrink-0 rounded-lg bg-neutral-300 dark:bg-neutral-700" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col text-sm">
                      <span className="truncate font-medium">{e.episode}. {e.name ?? `Episode ${e.episode}`}</span>
                      <span className="text-neutral-500">{unaired ? `Airs ${e.airDate}` : [e.runtime ? `${e.runtime} min` : null, e.airDate].filter(Boolean).join(" · ")}</span>
                    </span>
                  </>
                );
                const row = "flex items-center gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900";
                return (
                  <li key={e.episode} className={unaired ? "opacity-50" : ""}>
                    {picking ? (
                      <div className={`${row} ${on ? "ring-2 ring-neutral-950 dark:ring-white" : ""}`}>
                        <button type="button" disabled={unaired} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() => setPicked((cur) => { const next = new Set(cur); if (on) next.delete(e.episode); else next.add(e.episode); return next; })}>
                          {body}
                        </button>
                        {/* Picks this episode and every aired one before it that is not watched yet. */}
                        {!unaired && (
                          <button type="button" className="shrink-0 px-2 text-xs text-neutral-500"
                            onClick={() => setPicked(new Set(season.episodes.filter((x) => x.episode <= e.episode && !(x.airDate && x.airDate > today()) && !isCovered(covers, { season: x.season, episode: x.episode, airDate: x.airDate })).map((x) => x.episode)))}>
                            Up to here
                          </button>
                        )}
                      </div>
                    ) : id ? (
                      <Link href={`/episode/?id=${id}&s=${n}&e=${e.episode}`} className={row}>
                        {body}
                        {watched && <span role="img" aria-label="Watched" className="shrink-0 text-neutral-950 dark:text-white">✓</span>}
                      </Link>
                    ) : (
                      <Link href={`/episode/?tmdb=${tmdbParam}&s=${n}&e=${e.episode}`} className={row}>{body}</Link>
                    )}
                  </li>
                );
              })}
            </ul>

            {own.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="font-serif text-lg">Watched as a season</h2>
                <ul className="flex flex-col gap-2">
                  {own.map((v) => (
                    <li key={v.id}>
                      <Link href={`/title/?id=${id}`} className="flex justify-between gap-2 rounded-2xl border border-neutral-300 p-3 text-sm dark:border-neutral-700">
                        <span>{v.watchedOn ?? ""}</span>
                        <span className="text-neutral-500">{ORDINAL(oldestFirst.findIndex((x) => x.id === v.id) + 1)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {when && <WhenPopup what={`Season ${n}`} busy={busy} onToday={() => logSeason(today())} onForm={() => logWithForm()} onUndated={() => logSeason(null)} onClose={() => setWhen(false)} />}
      {pickWhen === "ask" && <WhenPopup what={picked.size === 1 ? "1 episode" : `${picked.size} episodes`} busy={busy} onToday={() => logPicked(today())} onForm={() => setPickWhen("date")} onUndated={() => logPicked(null)} onClose={() => setPickWhen(null)} />}
      {pickWhen === "date" && (
        <Popup title="Which day?" onClose={() => !busy && setPickWhen(null)}
          actions={
            <>
              <PopupAction icon="close" label="Cancel" tone="cancel" disabled={busy} onClick={() => setPickWhen(null)} />
              <PopupAction icon="check" label="Log" disabled={busy || !pickDate} onClick={() => logPicked(pickDate)} />
            </>
          }>
          <DateField value={pickDate} max={today()} onChange={setPickDate} label="Date" className="h-11 rounded-full bg-white/10 px-5 text-base text-white outline-none" hintClass="text-white/50" />
        </Popup>
      )}
    </main>
  );
}

export default function SeasonPage() {
  return (
    <Suspense>
      <SeasonView />
    </Suspense>
  );
}
