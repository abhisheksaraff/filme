// app/title/page.tsx
// One title: a hero picture, credits, posters and every time it has been watched.
"use client";

import RoundButton from "@/components/RoundButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import TitleHero from "@/components/TitleHero";
import CoverPicker from "@/components/CoverPicker";
import TitleActions from "@/components/TitleActions";
import PersonCircle from "@/components/PersonCircle";
import PerformerInput from "@/components/PerformerInput";
import { seatLabel } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { mediaCategorySchema } from "@/lib/domain/media";
import { syncCredits } from "@/lib/credits";
import { startEntryFrom } from "@/lib/logPrefill";
import { logWholeSeason } from "@/lib/logSeason";
import type { TitleCredits } from "@/lib/ports/browse";
import type { TitleDetail } from "@/lib/ports/log";
import { services } from "@/lib/services";

const card = "flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900";
const ROLE_LABEL: Record<string, string> = { actor: "Cast", director: "Director", producer: "Producer", writer: "Writer", creator: "Creator", performer: "Performers", opener: "Openers" };
const ORDINAL = (n: number) => (n === 1 ? "First viewing" : `Rewatch #${n - 1}`);

function TitleView() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");

  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [credits, setCredits] = useState<TitleCredits | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [wanted, setWanted] = useState(false);
  const [seasonPick, setSeasonPick] = useState("all");
  const [seasonDate, setSeasonDate] = useState("");

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    Promise.all([services.log.titleDetail(id), services.browse.titleCredits(id)]).then(([res, cr]) => {
      if (cancelled) return;
      if (res.ok) {
        setDetail(res.value);
        setProblem(null);
        if (res.value.tmdbId !== null && (res.value.category === "Movie" || res.value.category === "TV Show")) {
          services.wanted.status(res.value.category, res.value.tmdbId).then((s) => !cancelled && s.ok && setWanted(s.value.wanted));
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
      if (res.ok) setWanted(false);
      else setProblem(res.error);
    } else {
      const full = await services.catalog.details({ tmdbId: detail.tmdbId, kind: detail.category });
      const res = full.ok ? await services.wanted.add(full.value) : full;
      if (res.ok) setWanted(true);
      else setProblem(res.error);
    }
    setBusy(false);
  }

  function logAnother() {
    if (!detail) return;
    const category = mediaCategorySchema.safeParse(detail.category);
    if (!category.success) return;
    startEntryFrom({ category: category.data, title: detail.title, tmdbId: detail.tmdbId });
    router.push("/scan/");
  }

  async function logSeason() {
    if (!detail?.tmdbId) return;
    setBusy(true);
    setProblem(null);
    const res = await logWholeSeason(detail.tmdbId, seasonPick === "all" ? null : Number(seasonPick), seasonDate || null);
    if (!res.ok) setProblem(res.error);
    else setReload((n) => n + 1);
    setBusy(false);
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
  // Oldest first, so the first time you watched it is labelled "First viewing".
  const order = new Map([...(detail?.viewings ?? [])].reverse().map((v, i) => [v.id, i + 1]));

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5">
      <TitleHero
        backdropUrl={backdrop}
        posterUrl={poster}
        title={detail?.title ?? ""}
        subtitle={detail ? [detail.releaseDate?.slice(0, 4), detail.runtime ? `${detail.runtime} min` : null, detail.category].filter(Boolean).join(" · ") : ""}
        loading={!detail && !problem}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

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

            <TitleActions
              wanted={wanted}
              canBookmark={detail.tmdbId !== null && (detail.category === "Movie" || detail.category === "TV Show")}
              watched={detail.viewings.length > 0}
              watch={isLive ? null : { tmdbId: detail.tmdbId, kind: isShow ? "TV Show" : "Movie", title: detail.title, year: detail.releaseDate?.slice(0, 4) ?? null }}
              busy={busy}
              onToggleWanted={toggleWanted}
              onLog={logAnother}
            />

            {isShow && detail.tmdbId !== null && (
              <section className={card}>
                <h2 className="font-serif text-lg">Log a whole season</h2>
                <div className="flex flex-wrap gap-2">
                  <select value={seasonPick} onChange={(e) => setSeasonPick(e.target.value)} className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" aria-label="Season">
                    <option value="all">Whole show</option>
                    {Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>Season {i + 1}</option>)}
                  </select>
                  <input type="date" value={seasonDate} onChange={(e) => setSeasonDate(e.target.value)} aria-label="Date watched" className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
                </div>
                <RoundButton icon="layers" label="Log every episode" tone="dark" disabled={busy} onClick={logSeason} className="self-start" />
              </section>
            )}

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

            <section className="flex flex-col gap-2">
              <h2 className="font-serif text-lg">Pictures</h2>
              <CoverPicker mediaId={detail.mediaId} tmdbId={detail.tmdbId} category={detail.category} kind="poster" onChanged={() => setReload((n) => n + 1)} />
              <CoverPicker mediaId={detail.mediaId} tmdbId={detail.tmdbId} category={detail.category} kind="backdrop" onChanged={() => setReload((n) => n + 1)} />
            </section>

            <h2 className="font-serif text-xl">Your viewings</h2>
            <ul className="flex flex-col gap-4">
              {detail.viewings.map((v) => (
                <li key={v.id}>
                  {/* The whole row is one link: details, edit and delete live on the viewing's own page. */}
                  <Link href={`/session/?id=${v.id}`} className="flex flex-col gap-2 rounded-2xl border border-neutral-300 p-4 dark:border-neutral-700">
                    <span className="text-xs uppercase tracking-wide text-neutral-500">{ORDINAL(order.get(v.id) ?? 1)}</span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{[v.watchedOn ?? "Date unknown", v.watchedAt].filter(Boolean).join(" · ")}</span>
                      {v.rating !== null && <span className="text-sm">★ {v.rating}</span>}
                    </div>
                    <span className="text-sm text-neutral-500">
                      {v.venue}
                      {[v.auditorium, v.primaryFormat].filter(Boolean).length > 0 && ` · ${[v.auditorium, v.primaryFormat].filter(Boolean).join(" · ")}`}
                    </span>
                    {v.seats.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {v.seats.map((seat, i) => (
                          <span key={i} className="rounded-full bg-neutral-950 px-3 py-0.5 text-sm text-white dark:bg-white dark:text-neutral-950">{seatLabel(seat)}</span>
                        ))}
                      </div>
                    )}
                    {v.notes && <p className="text-sm">{v.notes}</p>}
                    {v.stubUrls.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {v.stubUrls.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="Ticket stub" className="h-32 rounded-lg" />
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
              {detail.viewings.length === 0 && <li className="text-sm text-neutral-500">No viewings left.</li>}
            </ul>
          </>
        )}
      </div>

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
