// app/title/page.tsx
// One title: a hero picture, credits, posters and every time it has been watched.
"use client";

import { keepIfSame } from "@/lib/same";
import ProblemPopup from "@/components/ProblemPopup";
import { toast } from "@/components/Toast";
import RoundButton from "@/components/RoundButton";
import PicturesViewer from "@/components/PicturesViewer";
import RatingsLine from "@/components/RatingsLine";
import type { TitleLinks } from "@/lib/ports/ratings";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import TitleHero from "@/components/TitleHero";
import TitleActions from "@/components/TitleActions";
import PersonCircle from "@/components/PersonCircle";
import PerformerInput from "@/components/PerformerInput";
import ViewingPictures from "@/components/ViewingPictures";
import WatchButton from "@/components/WatchButton";
import WatchedCard from "@/components/WatchedCard";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { mediaCategorySchema } from "@/lib/domain/media";
import { syncCredits } from "@/lib/credits";
import { startEntryFrom } from "@/lib/logPrefill";
import { logShowNow } from "@/lib/logShow";
import LogMenu from "@/components/LogMenu";
import ShowSection from "@/components/ShowSection";
import { lastWatchedText, latestViewing } from "@/lib/domain/lastWatched";
import { useShowData } from "@/hooks/useShowData";
import { scopeRank, type Cover } from "@/lib/domain/tv";
import type { TitleCredits } from "@/lib/ports/browse";
import type { TitleDetail } from "@/lib/ports/log";
import { services } from "@/lib/services";

const card = "flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900";
const ROLE_LABEL: Record<string, string> = { actor: "Cast", director: "Director", producer: "Producer", writer: "Writer", creator: "Creator", performer: "Performers", opener: "Openers" };
const ORDINAL = (n: number) => (n === 1 ? "First viewing" : `Rewatch #${n - 1}`);

function TitleView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [credits, setCredits] = useState<TitleCredits | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [wanted, setWanted] = useState(false);
  const [links, setLinks] = useState<TitleLinks | null>(null);
  const [viewer, setViewer] = useState<"poster" | "backdrop" | null>(null);
  const [menu, setMenu] = useState(false);
  const showData = useShowData(detail?.category === "TV Show" ? detail.tmdbId : null, ready);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    Promise.all([services.log.titleDetail(id), services.browse.titleCredits(id)]).then(([res, cr]) => {
      if (cancelled) return;
      if (res.ok) {
        setDetail((prev) => keepIfSame(prev, res.value));
        setProblem(null);
        if (res.value.tmdbId !== null && (res.value.category === "Movie" || res.value.category === "TV Show")) {
          services.wanted.status(res.value.category, res.value.tmdbId).then((s) => !cancelled && s.ok && setWanted(s.value.wanted));
        }
        if (res.value.category === "Movie" || res.value.category === "TV Show") {
          services.ratings.forTitle({ mediaId: res.value.mediaId, kind: res.value.category, tmdbId: res.value.tmdbId }).then((r) => !cancelled && r.ok && setLinks(r.value));
        }
        // Titles saved before credits existed get them the first time they are opened.
        if (cr.ok && cr.value.people.length === 0 && res.value.tmdbId !== null && (res.value.category === "Movie" || res.value.category === "TV Show")) {
          syncCredits(res.value.mediaId, res.value.category, res.value.tmdbId).then(() => {
            services.browse.titleCredits(res.value.mediaId).then((again) => !cancelled && again.ok && setCredits(again.value));
          });
        }
      } else setProblem(res.error);
      if (cr.ok) setCredits(cr.value);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  async function toggleWanted() {
    if (!detail || detail.tmdbId === null || (detail.category !== "Movie" && detail.category !== "TV Show")) return;
    setBusy(true);
    setProblem(null);
    if (wanted) {
      const res = await services.wanted.remove(detail.mediaId);
      if (res.ok) {
        setWanted(false);
        toast("Removed from watchlist");
      }
      else setProblem(res.error);
    } else {
      const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: detail.category });
      const res = full.ok ? await services.wanted.add(full.value) : full;
      if (res.ok) {
        setWanted(true);
        toast("Added to watchlist");
      }
      else setProblem(res.error);
    }
    setBusy(false);
  }

  /** Opens the entry form for this title; for a show, with the season (and episode) already filled in. */
  function logAnother(season: number | null = null, episode: number | null = null) {
    if (!detail) return;
    const category = mediaCategorySchema.safeParse(detail.category);
    if (!category.success) return;
    startEntryFrom({ category: category.data, title: detail.title, tmdbId: detail.tmdbId, season, episode });
    router.push("/scan/");
  }

  /** From the + on a show: one viewing for the whole series or a season, dated today, or the form to choose a date. */
  async function logShow(season: number | null, today: boolean, undated = false) {
    if (!today && !undated) return logAnother(season, null);
    if (!detail?.tmdbId) return;
    setBusy(true);
    setProblem(null);
    const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: "TV Show" });
    const res = full.ok ? await logShowNow(full.value, season, null, undated ? null : new Date().toISOString().slice(0, 10)) : full;
    setBusy(false);
    setMenu(false);
    if (!res.ok) return setProblem(res.error);
    toast(season === null ? "Logged the whole series" : `Logged Season ${season}`);
    setReload((n) => n + 1);
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No title selected.</main>;

  const backdrop = tmdbImageUrl(detail?.backdropPath, "w780") ?? tmdbImageUrl(detail?.posterPath, "w780");
  const poster = tmdbImageUrl(detail?.posterPath, "w342");
  const isShow = detail?.category === "TV Show";
  const isLive = detail?.category === "Concert" || detail?.category === "Live Event";
  const groups = Object.entries(
    (credits?.people ?? []).reduce<Record<string, TitleCredits["people"]>>((acc, p) => ({ ...acc, [p.role]: [...(acc[p.role] ?? []), p] }), {}),
  );
  // Oldest first, so the first time you watched it is labelled "First viewing". A show counts each series, season
  // and episode on its own, so watching Season 2 again is a rewatch of Season 2 and not of the whole show.
  const order = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const v of [...(detail?.viewings ?? [])].reverse()) {
    const key = `${v.scope}:${v.season ?? ""}:${v.episode ?? ""}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    order.set(v.id, n);
  }
  const lastLine = lastWatchedText(latestViewing(detail?.viewings ?? []), isShow);
  const viewings = isShow ? [...(detail?.viewings ?? [])].sort((a, b) => scopeRank(a.season, a.episode) - scopeRank(b.season, b.episode)) : detail?.viewings ?? [];
  const covers: Cover[] = (detail?.viewings ?? []).map((v) => ({ scope: v.scope, season: v.season, episode: v.episode, date: v.watchedOn }));

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5">
      <TitleHero
        backdropUrl={backdrop}
        posterUrl={poster}
        title={detail?.title ?? ""}
        subtitle={detail ? [detail.releaseDate?.slice(0, 4), detail.runtime ? `${detail.runtime} min` : null, detail.category].filter(Boolean).join(" · ") : ""}
        loading={!detail && !problem}
        onCoverClick={detail ? () => setViewer("backdrop") : undefined}
        onPosterClick={detail ? () => setViewer("poster") : undefined}
        extra={detail && !isLive && <RatingsLine links={links} mine={detail.viewings.find((v) => v.rating !== null)?.rating ?? null} />}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        <ProblemPopup message={problem} onClose={() => setProblem(null)} />

        {detail && (
          <>
            <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
              <li className={`${card} w-40 shrink-0`}>
                <span className="text-neutral-500">Details</span>
                <span>{[detail.releaseDate?.slice(0, 4), detail.runtime ? `${detail.runtime} min` : null, detail.category].filter(Boolean).join(" · ")}</span>
              </li>
              {credits && credits.genres.length > 0 && (
                <li className={`${card} w-40 shrink-0`}>
                  <span className="text-neutral-500">Genres</span>
                  <span>{credits.genres.join(", ")}</span>
                </li>
              )}
              <li className={`${card} w-40 shrink-0`}>
                <span className="text-neutral-500">Watched</span>
                <span>{detail.viewings.length} {detail.viewings.length === 1 ? "time" : "times"}</span>
              </li>
            </ul>

            {detail.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{detail.overview}</p>}
            {lastLine && <p className="-mt-3 text-xs text-neutral-500">{lastLine}</p>}

            <TitleActions
              wanted={wanted}
              canBookmark={detail.tmdbId !== null && (detail.category === "Movie" || detail.category === "TV Show")}
              watch={isLive ? null : { tmdbId: detail.tmdbId, kind: isShow ? "TV Show" : "Movie", title: detail.title, year: detail.releaseDate?.slice(0, 4) ?? null }}
              busy={busy}
              onToggleWanted={toggleWanted}
              onLog={isShow ? () => setMenu(true) : () => logAnother()}
            />

            {isShow && detail.tmdbId !== null && <ShowSection mediaId={detail.mediaId} data={showData} covers={covers} />}

            {groups.map(([role, people]) => (
              <section key={role} className="flex flex-col gap-2">
                <h2 className="font-serif text-lg">{ROLE_LABEL[role] ?? role}</h2>
                <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                  {people.map((p) => (
                    <PersonCircle key={`${p.personId}-${role}`} href={`/person/?id=${p.personId}`} name={p.name} profilePath={p.profilePath} note={p.character} />
                  ))}
                </ul>
              </section>
            ))}

            {isLive && <PerformerInput mediaId={detail.mediaId} onAdded={() => setReload((n) => n + 1)} />}

            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-lg">Update photos</h2>
              <div className="flex gap-6">
                {([["poster", "posterFrame", "Poster"], ["backdrop", "coverFrame", "Cover"]] as const).map(([kind, icon, label]) => (
                  <div key={kind} className="flex flex-col items-center gap-1.5">
                    <RoundButton icon={icon} label={`Change the ${label.toLowerCase()}`} tone="dark" size="lg" onClick={() => setViewer(kind)} />
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <h2 className="font-serif text-xl">Your viewings</h2>
            <ul className="flex flex-col gap-5">
              {viewings.map((v, i) => (
                <WatchedCard
                  key={v.id}
                  index={i}
                  showTitle={false}
                  animate
                  href={`/title/?id=${detail.mediaId}`}
                  label={ORDINAL(order.get(v.id) ?? 1)}
                  rating={v.rating}
                  notes={v.notes}
                  editHref={`/entry/?id=${v.id}`}
                  footer={<ViewingPictures sessionId={v.id} />}
                  actions={v.season !== null && v.episode !== null && detail.tmdbId !== null && isShow ? (
                    <WatchButton watch={{ tmdbId: detail.tmdbId, kind: "TV Show", title: detail.title, year: detail.releaseDate?.slice(0, 4) ?? null, season: v.season, episode: v.episode }} />
                  ) : undefined}
                  entry={{
                    id: v.id, mediaId: detail.mediaId, title: detail.title, category: detail.category, posterPath: detail.posterPath,
                    watchedOn: v.watchedOn, watchedAt: v.watchedAt, primaryFormat: v.primaryFormat, addons: v.addons,
                    venueId: v.venueId, venue: v.venue, venueLatitude: v.venueLatitude, venueLongitude: v.venueLongitude,
                    auditorium: v.auditorium, seats: v.seats, totalTickets: v.totalTickets, season: v.season, episode: v.episode,
                  }}
                />
              ))}
              {detail.viewings.length === 0 && <li className="text-sm text-neutral-500">No viewings left.</li>}
            </ul>
          </>
        )}
      </div>

      {menu && detail && (
        <LogMenu
          seasons={showData?.seasons.map((x) => x.season) ?? []}
          busy={busy}
          onClose={() => setMenu(false)}
          onLog={logShow}
          onLogUndated={(season) => void logShow(season, false, true)}
          onEpisodeSeason={(n) => router.push(`/season/?id=${detail.mediaId}&n=${n}`)}
        />
      )}

      {viewer && detail && (
        <PicturesViewer
          mediaId={detail.mediaId}
          tmdbId={detail.tmdbId}
          category={detail.category}
          kind={viewer}
          currentPath={viewer === "poster" ? detail.posterPath : detail.backdropPath}
          onChanged={() => setReload((n) => n + 1)}
          onClose={() => setViewer(null)}
        />
      )}
    </main>
  );
}

export default function TitlePage() {
  return (
    <Suspense>
      <TitleView />
    </Suspense>
  );
}
