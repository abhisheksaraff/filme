// app/season/page.tsx
// One season of a show: its episodes with progress, and the same bookmark, tick, Watch and + as the show.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import type { TitleDetail } from "@/lib/ports/log";
import { services } from "@/lib/services";

const today = () => new Date().toISOString().slice(0, 10);
const ORDINAL = (n: number) => (n === 1 ? "First viewing" : `Rewatch #${n - 1}`);

function SeasonView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const n = Number(params.get("n"));

  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [wanted, setWanted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready || !id || !Number.isInteger(n)) return;
    let cancelled = false;
    (async () => {
      const res = await services.log.titleDetail(id);
      if (cancelled) return;
      if (!res.ok || res.value.tmdbId === null) return setProblem(res.ok ? "This show has no catalogue page." : res.error);
      setDetail(res.value);
      const [s, w] = await Promise.all([
        services.catalog.season(res.value.tmdbId, n),
        services.wanted.status("TV Show", res.value.tmdbId, { season: n, episode: null }),
      ]);
      if (cancelled) return;
      if (s.ok) setSeason(s.value);
      else setProblem(s.error);
      if (w.ok) setWanted(w.value.wanted);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, n, reload]);

  async function toggleWanted() {
    if (!detail?.tmdbId) return;
    setBusy(true);
    const scope = { season: n, episode: null };
    let res;
    if (wanted) res = await services.wanted.remove(detail.mediaId, scope);
    else {
      const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
      res = full.ok ? await services.wanted.add(full.value, scope) : full;
    }
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    setWanted(!wanted);
    toast(wanted ? "Removed from watchlist" : "Added to watchlist");
  }

  async function logSeasonNow() {
    if (!detail?.tmdbId) return;
    setBusy(true);
    const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
    const res = full.ok ? await logShowNow(full.value, n, null) : full;
    setBusy(false);
    setWhen(false);
    if (!res.ok) return setProblem(res.error);
    toast(`Logged Season ${n}`);
    setReload((k) => k + 1);
  }

  function logWithForm(episode: number | null = null) {
    if (!detail) return;
    startEntryFrom({ category: "TV Show", title: detail.title, tmdbId: detail.tmdbId, season: n, episode });
    router.push("/scan/");
  }

  if (!ready) return null;
  if (!id || !Number.isInteger(n)) return <main className="p-6 text-sm">No season selected.</main>;

  const covers: Cover[] = (detail?.viewings ?? []).map((v) => ({ scope: v.scope, season: v.season, episode: v.episode, date: v.watchedOn }));
  const keys = (season?.episodes ?? []).map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate }));
  const progress = progressOf(covers, keys, today());
  // The latest viewing that included any of this season: the series, the season itself, or one of its episodes.
  const lastLine = lastWatchedText(latestViewing((detail?.viewings ?? []).filter((v) => v.scope === "show" || v.season === n)), true);
  const own = (detail?.viewings ?? []).filter((v) => v.scope === "season" && v.season === n);
  const oldestFirst = [...own].reverse();

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5">
      <TitleHero
        titleHref={`/title/?id=${id}`}
        backdropUrl={tmdbImageUrl(detail?.backdropPath, "w780")}
        posterUrl={tmdbImageUrl(season?.posterPath ?? detail?.posterPath, "w342")}
        title={season?.name ?? `Season ${n}`}
        subtitle={detail ? [detail.title, season?.airDate?.slice(0, 4), season ? `${season.episodes.length} episodes` : null].filter(Boolean).join(" · ") : ""}
        loading={!detail && !problem}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

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

            <ul className="flex flex-col gap-2">
              {season.episodes.map((e) => {
                const unaired = !!e.airDate && e.airDate > today();
                const watched = isCovered(covers, { season: e.season, episode: e.episode, airDate: e.airDate });
                const still = tmdbImageUrl(e.stillPath, "w342");
                return (
                  <li key={e.episode} className={unaired ? "opacity-50" : ""}>
                    <Link href={`/episode/?id=${id}&s=${n}&e=${e.episode}`} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900">
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
                      {watched && <span role="img" aria-label="Watched" className="shrink-0 text-neutral-950 dark:text-white">✓</span>}
                    </Link>
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
                      <Link href={`/session/?id=${v.id}`} className="flex justify-between gap-2 rounded-2xl border border-neutral-300 p-3 text-sm dark:border-neutral-700">
                        <span>{v.watchedOn ?? "Date unknown"}</span>
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

      {when && <WhenPopup what={`Season ${n}`} busy={busy} onToday={logSeasonNow} onForm={() => logWithForm()} onClose={() => setWhen(false)} />}
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
