// app/preview/page.tsx
// A catalogue title you have not logged (or have): details, plus add or remove from your watchlist.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { toast } from "@/components/Toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ConfirmPopup } from "@/components/Popup";
import LogMenu from "@/components/LogMenu";
import PersonCircle from "@/components/PersonCircle";
import SeasonTiles from "@/components/SeasonTiles";
import RatingsLine from "@/components/RatingsLine";
import TitleActions from "@/components/TitleActions";
import TitleHero from "@/components/TitleHero";
import TmdbPicturesViewer from "@/components/TmdbPicturesViewer";
import { handoffFor } from "@/lib/handoff";
import { clearHomeCache } from "@/lib/home/rows";
import { startEntryFrom } from "@/lib/logPrefill";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useShowData } from "@/hooks/useShowData";
import { logShowNow } from "@/lib/logShow";
import type { LastViewing } from "@/lib/domain/lastWatched";
import { lastWatchedText } from "@/lib/domain/lastWatched";
import type { CatalogDetails, CatalogKind } from "@/lib/ports/catalog";
import type { TitleLinks } from "@/lib/ports/ratings";
import type { TitleStatus } from "@/lib/ports/wanted";
import { services } from "@/lib/services";

const ROLES: [string, string][] = [["actor", "Cast"], ["director", "Director"], ["creator", "Creator"], ["producer", "Producer"], ["writer", "Writer"]];

function PreviewView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const kind: CatalogKind | null = params.get("kind") === "movie" ? "Movie" : params.get("kind") === "tv" ? "TV Show" : null;
  const id = Number(params.get("id"));

  const [details, setDetails] = useState<CatalogDetails | null>(null);
  const [status, setStatus] = useState<TitleStatus | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<TitleLinks | null>(null);
  // "Not interested": null while unknown, then whether this title is already hidden from Home.
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);
  const [last, setLast] = useState<LastViewing | null>(null);
  const [menu, setMenu] = useState(false);
  // Which kind of picture the viewer is showing, if it is open.
  const [viewer, setViewer] = useState<"poster" | "backdrop" | null>(null);
  // What the tile that opened this page already showed, so the poster and name are there before the details are.
  const [early] = useState(() => handoffFor(kind, id));
  const showData = useShowData(kind === "TV Show" ? id : null, ready);

  useEffect(() => {
    if (!ready || kind === null || !Number.isInteger(id) || id <= 0) return;
    let cancelled = false;
    Promise.all([services.catalog.details({ tmdbId: id, kind }), services.wanted.status(kind, id)]).then(([d, s]) => {
      if (cancelled) return;
      if (d.ok) setDetails(d.value);
      else setProblem(d.error);
      if (s.ok) {
        setStatus(s.value);
        if (s.value.mediaId && s.value.logged) services.log.lastViewing(s.value.mediaId).then((l) => !cancelled && l.ok && setLast(l.value));
      }
      services.hidden.list().then((h) => !cancelled && h.ok && setHidden(h.value.some((t) => t.category === kind && t.tmdbId === id)));
      if (d.ok) {
        services.ratings
          .forTitle({ mediaId: s.ok ? s.value.mediaId : null, kind, tmdbId: id, known: { imdbId: d.value.imdbId, tmdbRating: d.value.voteAverage } })
          .then((r) => !cancelled && r.ok && setLinks(r.value));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, kind, id]);

  async function toggleWanted() {
    if (!details || !status) return;
    setBusy(true);
    setProblem(null);
    if (status.wanted && status.mediaId) {
      const res = await services.wanted.remove(status.mediaId);
      if (res.ok) {
        setStatus({ ...status, wanted: false });
        toast("Removed from watchlist");
      }
      else setProblem(res.error);
    } else {
      const res = await services.wanted.add(details);
      if (res.ok) {
        setStatus({ mediaId: res.value, wanted: true, logged: status.logged });
        toast("Added to watchlist");
      }
      else setProblem(res.error);
    }
    setBusy(false);
  }

  async function hideTitle() {
    if (!details) return;
    setBusy(true);
    const res = await services.hidden.hide({ category: details.category, tmdbId: details.tmdbId, title: details.title, posterPath: details.posterPath });
    setBusy(false);
    setConfirmHide(false);
    if (!res.ok) return setProblem(res.error);
    // Rows already on screen are rebuilt without it the next time Home opens.
    clearHomeCache();
    toast("Hidden from recommendations");
    if (window.history.length > 1) router.back();
    else router.push("/home/");
  }

  /** From the + on a show: the whole series or a season, today, on a chosen date, or with no date. */
  async function logShow(season: number | null, today: boolean, undated = false) {
    if (!details) return;
    if (!today && !undated) {
      startEntryFrom({ category: "TV Show", title: details.title, tmdbId: details.tmdbId, season });
      return void router.push("/scan/");
    }
    setBusy(true);
    const res = await logShowNow(details, season, null, undated ? null : new Date().toISOString().slice(0, 10));
    setBusy(false);
    setMenu(false);
    if (!res.ok) return setProblem(res.error);
    toast(season === null ? "Logged the whole series" : `Logged Season ${season}`);
    router.replace(`/title/?id=${res.value}`);
  }

  function logViewing() {
    if (!details) return;
    if (details.category === "TV Show") return setMenu(true);
    startEntryFrom({ category: details.category, title: details.title, tmdbId: details.tmdbId });
    router.push("/scan/");
  }

  if (!ready) return null;
  if (kind === null || !Number.isInteger(id) || id <= 0) return <main className="p-6 text-sm">No title selected.</main>;
  const lastLine = lastWatchedText(last, kind === "TV Show");

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5">
      <TitleHero
        backdropUrl={details?.backdropUrl ?? details?.posterUrl ?? null}
        posterUrl={details?.posterUrl ?? early?.posterUrl ?? null}
        title={details?.title ?? early?.title ?? ""}
        subtitle={details ? [details.releaseYear, details.runtime ? `${details.runtime} min` : null, details.category].filter(Boolean).join(" · ") : (early?.subtitle ?? "")}
        onCoverClick={details ? () => setViewer("backdrop") : undefined}
        onPosterClick={details ? () => setViewer("poster") : undefined}
        loading={!details && !problem}
        extra={details && <RatingsLine links={links} mine={null} />}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        <ProblemPopup message={problem} onClose={() => setProblem(null)} />

        {details && (
          <div className="rise flex flex-col gap-5">
            {details.genres.length > 0 && <span className="text-sm text-neutral-500">{details.genres.join(", ")}</span>}

            {status && (
              <>
                <TitleActions
                  wanted={status.wanted}
                  canBookmark
                  watch={{ tmdbId: details.tmdbId, kind: details.category === "TV Show" ? "TV Show" : "Movie", title: details.title, year: details.releaseYear ? String(details.releaseYear) : null }}
                  busy={busy}
                  onToggleWanted={toggleWanted}
                  onLog={logViewing}
                />
                {status.logged && status.mediaId && (
                  <Link href={`/title/?id=${status.mediaId}`} className="self-start text-sm font-medium">See your viewings</Link>
                )}
              </>
            )}

            {details.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{details.overview}</p>}

            {/* Seasons are there before anything is logged, so one season or episode can be logged on its own. */}
            {details.category === "TV Show" && !status?.logged && showData && (
              <SeasonTiles data={showData} covers={[]} hrefFor={(n) => `/season/?tmdb=${details.tmdbId}&n=${n}`} />
            )}
            {lastLine && <p className="-mt-3 text-xs text-neutral-500">{lastLine}</p>}

            {ROLES.map(([role, label]) => {
              const people = details.credits.filter((c) => c.role === role);
              if (people.length === 0) return null;
              return (
                <section key={role} className="flex flex-col gap-2">
                  <h2 className="font-serif text-lg">{label}</h2>
                  <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                    {people.map((p) => (
                      <PersonCircle key={`${p.tmdbId}-${role}`} href={`/person/?tmdb=${p.tmdbId}`} name={p.name} profilePath={p.profilePath} note={p.character} />
                    ))}
                  </ul>
                </section>
              );
            })}

            {/* Only for titles you have not logged: a way to stop them coming up on Home. */}
            {status && !status.logged && hidden !== null && (
              hidden ? (
                <p className="self-center py-2 text-sm text-neutral-500">Hidden from recommendations.</p>
              ) : (
                <button type="button" onClick={() => setConfirmHide(true)} className="self-center py-2 text-sm text-neutral-500">
                  Not interested
                </button>
              )
            )}
          </div>
        )}
      </div>

      {viewer && details && (
        <TmdbPicturesViewer
          kind={details.category === "TV Show" ? "TV Show" : "Movie"}
          tmdbId={details.tmdbId}
          shape={viewer}
          currentPath={viewer === "poster" ? details.posterPath : details.backdropPath}
          onClose={() => setViewer(null)}
        />
      )}

      {menu && details && (
        <LogMenu
          seasons={showData?.seasons.map((x) => x.season) ?? []}
          busy={busy}
          onClose={() => setMenu(false)}
          onLog={(season, today) => void logShow(season, today)}
          onLogUndated={(season) => void logShow(season, false, true)}
          onEpisodeSeason={(n) => router.push(`/season/?tmdb=${details.tmdbId}&n=${n}`)}
        />
      )}

      {confirmHide && (
        <ConfirmPopup
          title="Not interested in this?"
          message="It will be hidden from your Home recommendations. You can undo this under Profile, Not interested."
          confirmLabel="Hide"
          busy={busy}
          onConfirm={hideTitle}
          onCancel={() => setConfirmHide(false)}
        />
      )}
    </main>
  );
}

export default function PreviewPage() {
  return (
    <Suspense>
      <PreviewView />
    </Suspense>
  );
}
