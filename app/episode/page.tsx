// app/episode/page.tsx
// One episode: its still, details and every viewing that covered it, with bookmark, tick, Watch and +.
"use client";

import { keepIfSame } from "@/lib/same";
import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import WhenPopup from "@/components/WhenPopup";
import { lastWatchedText, latestViewing } from "@/lib/domain/lastWatched";
import TitleActions from "@/components/TitleActions";
import TitleHero from "@/components/TitleHero";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { isCovered, scopeLabel } from "@/lib/domain/tv";
import { startEntryFrom } from "@/lib/logPrefill";
import { logShowNow } from "@/lib/logShow";
import type { SeasonDetail } from "@/lib/ports/catalog";
import type { ViewingSummary } from "@/lib/ports/log";
import { services } from "@/lib/services";

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

function EpisodeView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  // A show that is not in your log yet is opened by its TMDB id, so its episodes can still be opened and logged.
  const tmdbParam = Number(params.get("tmdb")) || null;
  const s = Number(params.get("s"));
  const e = Number(params.get("e"));

  const [detail, setDetail] = useState<ShowInfo | null>(null);
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [wanted, setWanted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready || (!id && !tmdbParam) || !Number.isInteger(s) || !Number.isInteger(e)) return;
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
      setDetail((prev) => keepIfSame(prev, info));
      const [season, w] = await Promise.all([
        services.catalog.season(info.tmdbId, s),
        services.wanted.status("TV Show", info.tmdbId, { season: s, episode: e }),
      ]);
      if (cancelled) return;
      if (season.ok) setSeason(season.value);
      else setProblem(season.error);
      if (w.ok) {
        setWanted(w.value.wanted);
        if (w.value.mediaId) setDetail((d) => (d && !d.mediaId ? { ...d, mediaId: w.value.mediaId } : d));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, tmdbParam, s, e, reload]);

  async function toggleWanted() {
    if (!detail?.tmdbId) return;
    setBusy(true);
    const scope = { season: s, episode: e };
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

  async function logNow(date: string | null = new Date().toISOString().slice(0, 10)) {
    if (!detail?.tmdbId) return;
    setBusy(true);
    const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
    const res = full.ok ? await logShowNow(full.value, s, e, date) : full;
    setBusy(false);
    setWhen(false);
    if (!res.ok) return setProblem(res.error);
    toast(`Logged S${s} E${e}`);
    // A show that had no viewings is now in your log, so the page moves to its own address.
    if (id) setReload((k) => k + 1);
    else router.replace(`/episode/?id=${res.value}&s=${s}&e=${e}`);
  }

  function logWithForm() {
    if (!detail) return;
    startEntryFrom({ category: "TV Show", title: detail.title, tmdbId: detail.tmdbId, season: s, episode: e });
    router.push("/scan/");
  }

  if (!ready) return null;
  if ((!id && !tmdbParam) || !Number.isInteger(s) || !Number.isInteger(e)) return <main className="p-6 text-sm">No episode selected.</main>;

  const episode = season?.episodes.find((x) => x.episode === e) ?? null;
  const key = { season: s, episode: e, airDate: episode?.airDate ?? null };
  // Every viewing that included this episode, whether it was logged alone or as part of a season or the series.
  const covering = (detail?.viewings ?? []).filter((v) => isCovered([{ scope: v.scope, season: v.season, episode: v.episode, date: v.watchedOn }], key));
  const oldestFirst = [...covering].reverse();
  const lastLine = lastWatchedText(latestViewing(covering), true);
  const showQuery = id ? `id=${id}` : `tmdb=${tmdbParam}`;
  const previous = season?.episodes.find((x) => x.episode === e - 1);
  const next = season?.episodes.find((x) => x.episode === e + 1);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5">
      <TitleHero
        titleHref={`/season/?${showQuery}&n=${s}`}
        backdropUrl={tmdbImageUrl(episode?.stillPath, "w780") ?? tmdbImageUrl(detail?.backdropPath, "w780")}
        posterUrl={tmdbImageUrl(detail?.posterPath, "w342")}
        title={episode?.name ?? `Episode ${e}`}
        subtitle={detail ? [detail.title, scopeLabel(s, e), episode?.runtime ? `${episode.runtime} min` : null, episode?.airDate].filter(Boolean).join(" · ") : ""}
        loading={!detail && !problem}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        <ProblemPopup message={problem} onClose={() => setProblem(null)} />

        {detail && (
          <>
            <TitleActions
              wanted={wanted}
              canBookmark
              watch={{ tmdbId: detail.tmdbId, kind: "TV Show", title: detail.title, year: detail.releaseDate?.slice(0, 4) ?? null, season: s, episode: e }}
              busy={busy}
              onToggleWanted={toggleWanted}
              onLog={() => setWhen(true)}
            />

            {episode?.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{episode.overview}</p>}
            {lastLine && <p className="-mt-3 text-xs text-neutral-500">{lastLine}</p>}

            <nav className="flex justify-between gap-3 text-sm">
              {previous ? <Link href={`/episode/?${showQuery}&s=${s}&e=${previous.episode}`} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">← E{previous.episode}</Link> : <span />}
              {next && <Link href={`/episode/?${showQuery}&s=${s}&e=${next.episode}`} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">E{next.episode} →</Link>}
            </nav>

            {covering.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="font-serif text-lg">Your viewings</h2>
                <ul className="flex flex-col gap-2">
                  {covering.map((v) => (
                    <li key={v.id}>
                      <Link href={`/title/?id=${detail.mediaId}&v=${v.id}`} className="flex justify-between gap-2 rounded-2xl border border-neutral-300 p-3 text-sm dark:border-neutral-700">
                        <span>{v.watchedOn ?? ""}{v.scope !== "episode" ? ` · with ${scopeLabel(v.season, null).toLowerCase()}` : ""}</span>
                        <span className="text-neutral-500">{oldestFirst.findIndex((x) => x.id === v.id) === 0 ? "First viewing" : `Rewatch #${oldestFirst.findIndex((x) => x.id === v.id)}`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {when && <WhenPopup what={`S${s} E${e}`} busy={busy} onToday={() => logNow()} onForm={logWithForm} onUndated={() => logNow(null)} onClose={() => setWhen(false)} />}
    </main>
  );
}

export default function EpisodePage() {
  return (
    <Suspense>
      <EpisodeView />
    </Suspense>
  );
}
