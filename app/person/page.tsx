// app/person/page.tsx
// A cast or crew member: what you have seen them in, and what else they have done.
"use client";

import { keepIfSame } from "@/lib/same";
import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import ImageViewer from "@/components/ImageViewer";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { previewHref, seenKey } from "@/lib/home/rows";
import PersonCircle from "@/components/PersonCircle";
import StatusBadge from "@/components/StatusBadge";
import { useWantedKeys } from "@/lib/useWantedKeys";
import { scoreKey } from "@/lib/ports/ratings";
import type { PersonDetail, PersonPick } from "@/lib/ports/browse";
import type { CatalogPerson } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

/** People who work with this person: saved from TMDB, worked out once if not, or from your own log as a fallback. */
async function loadRelated(personId: string | null, tmdbId: number | null): Promise<PersonPick[]> {
  if (tmdbId !== null) {
    const saved = await services.browse.savedRelated(tmdbId);
    if (saved.ok && saved.value && saved.value.length > 0) return saved.value;
    if (!(saved.ok && saved.value)) {
      const fresh = await services.catalog.relatedPeople(tmdbId);
      if (fresh.ok) {
        const picks = fresh.value.map((p): PersonPick => ({ personId: null, tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath }));
        await services.browse.saveRelated(tmdbId, picks);
        if (picks.length > 0) return picks;
      }
    }
  }
  if (personId) {
    const own = await services.browse.relatedFromLog(personId);
    if (own.ok) return own.value;
  }
  return [];
}

function PersonView() {
  const ready = useRequireSession();
  const params = useSearchParams();
  const id = params.get("id");
  // A person only the catalogue knows (not saved yet) is opened by their TMDB id.
  const tmdbParam = Number(params.get("tmdb")) || null;
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [other, setOther] = useState<CatalogPerson | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The full-screen profile pictures: opens at once on the one shown, then gains the rest as TMDB answers.
  const [viewing, setViewing] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [related, setRelated] = useState<PersonPick[]>([]);
  // Everything you have logged, so "More from" only offers what you have not seen.
  const [everSeen, setEverSeen] = useState<Set<string>>(new Set());
  const wantedKeys = useWantedKeys();
  // IMDb scores (the catalogue's when there is none) for the films shown under "More from".
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.log.seen().then((res) => !cancelled && res.ok && setEverSeen(new Set(res.value)));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || (!id && !tmdbParam)) return;
    let cancelled = false;
    (async () => {
      let personId = id;
      if (!personId && tmdbParam) {
        const found = await services.browse.personIdByTmdb(tmdbParam);
        if (cancelled) return;
        if (!found.ok) return setProblem(found.error);
        personId = found.value;
      }
      if (personId) {
        const res = await services.browse.person(personId);
        if (cancelled) return;
        if (!res.ok) return setProblem(res.error);
        setPerson((prev) => keepIfSame(prev, res.value));
        loadRelated(personId, res.value.tmdbId).then((list) => !cancelled && setRelated(list));
        if (res.value.tmdbId !== null) {
          services.catalog.person(res.value.tmdbId).then((c) => !cancelled && c.ok && setOther(c.value));
        }
      } else if (tmdbParam) {
        const c = await services.catalog.person(tmdbParam);
        if (cancelled) return;
        if (!c.ok) return setProblem(c.error);
        setOther(c.value);
        setPerson({ id: "", tmdbId: tmdbParam, name: c.value.name, profilePath: null, works: [] });
        loadRelated(null, tmdbParam).then((list) => !cancelled && setRelated(list));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, tmdbParam]);

  const listed = (other?.works ?? []).filter((w) => !everSeen.has(seenKey(w.kind, w.tmdbId))).slice(0, 24);
  const moreKey = listed.map((h) => scoreKey(h)).join(",");
  useEffect(() => {
    if (listed.length === 0) return;
    let cancelled = false;
    void services.ratings
      .scores(listed.slice(0, 12).map((h) => ({ kind: h.kind, tmdbId: h.tmdbId, tmdbRating: h.voteAverage ?? null, releaseDate: h.releaseDate ?? null })), { fill: 6, onScore: (key, score) => !cancelled && setScores((m) => new Map(m).set(key, score)) })
      .then((m) => !cancelled && setScores((now) => new Map([...m, ...now])));
    return () => {
      cancelled = true;
    };
    // `listed` is rebuilt every render; its keys say when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreKey]);

  if (!ready) return null;
  if (!id && !tmdbParam) return <main className="p-6 text-sm">No person selected.</main>;

  const seen = person?.works.filter((w) => w.seen) ?? [];
  const more = (other?.works ?? []).filter((w) => !everSeen.has(seenKey(w.kind, w.tmdbId))).slice(0, 24);
  const catalogId = person?.tmdbId ?? tmdbParam;
  const picture = tmdbImageUrl(person?.profilePath, "w342") ?? other?.profileUrl ?? null;
  const shown = tmdbImageUrl(person?.profilePath, "original") ?? other?.profileUrl ?? null;
  // The picture on screen first, then TMDB's other profile pictures without repeating it.
  const gallery = [...(shown ? [shown] : []), ...photos.map((p) => tmdbImageUrl(p, "original")).filter((u): u is string => u !== null && u !== shown)];

  function openPhotos() {
    setViewing(true);
    if (photos.length > 0 || catalogId === null) return;
    services.catalog.personImages(catalogId).then((res) => res.ok && setPhotos(res.value));
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-5 pb-4 pt-6">
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {/* View only: no upload, note or delete handlers, so the viewer offers none of them. */}
      {viewing && gallery.length > 0 && <ImageViewer images={gallery.map((url) => ({ url }))} start={0} onClose={() => setViewing(false)} />}
      {person && (
        <>
          <div className="flex items-center gap-4">
            {picture ? (
              <button type="button" aria-label={`Show pictures of ${person.name}`} onClick={() => openPhotos()} className="shrink-0 rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={picture} alt="" className="h-24 w-24 rounded-full object-cover" />
              </button>
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name="user" size={40} /></span>
            )}
            <h1 className="font-serif text-3xl tracking-tight">{person.name}</h1>
          </div>
          {other?.biography && <p className="line-clamp-6 text-sm text-neutral-600 dark:text-neutral-400">{other.biography}</p>}
          {/* Dark text with a share arrow, like the one on a title; grey when IMDb has no page for them. */}
          {(other || person.tmdbId === null) && (other?.imdbId ? (
            <a href={`https://www.imdb.com/name/${other.imdbId}/`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 self-start text-sm font-medium text-neutral-950 dark:text-white">
              IMDb<Icon name="open" size={14} />
            </a>
          ) : (
            <span aria-disabled="true" title="No IMDb page for this person" className="flex items-center gap-1 self-start text-sm text-neutral-400 dark:text-neutral-600">
              IMDb<Icon name="open" size={14} />
            </span>
          ))}

          {person.id !== "" && <h2 className="font-serif text-xl">In your log ({seen.length})</h2>}
          {person.id !== "" && seen.length === 0 && <p className="text-sm text-neutral-500">Nothing you have watched lists them yet.</p>}
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {seen.map((w) => (
              <li key={w.mediaId}>
                <Link href={`/title/?id=${w.mediaId}`} className="flex flex-col gap-1">
                  {w.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(w.posterPath, "w342") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="aspect-[2/3] rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="font-serif text-base leading-tight">{w.title}</span>
                  <span className="text-xs capitalize text-neutral-500">{[...new Set(w.roles)].join(", ")}{w.year ? ` · ${w.year}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>

          {more.length > 0 && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl">More from {person.name}</h2>
                {catalogId !== null && (
                  <Link href={`/search/?personId=${catalogId}&name=${encodeURIComponent(person.name)}`} onClick={() => sessionStorage.removeItem("filme_seeall")} className="shrink-0 text-sm text-neutral-500">
                    See all
                  </Link>
                )}
              </div>
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                {more.map((hit) => (
                  <li key={`${hit.kind}-${hit.tmdbId}`} className="w-28 shrink-0">
                    <Link href={previewHref(hit.kind, hit.tmdbId)} className="flex flex-col gap-1">
                      <div className="relative">
                        {hit.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hit.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
                        ) : (
                          <div className="aspect-[2/3] rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                        )}
                        {wantedKeys.has(`tmdb:${hit.kind === "TV Show" ? "tv" : "movie"}:${hit.tmdbId}`) && <StatusBadge kind="watchlist" className="absolute right-[4%] top-[3%]" />}
                      </div>
                      <span className="line-clamp-2 text-xs font-medium">{hit.title}</span>
                      {(() => {
                        const score = scores.get(scoreKey(hit));
                        const line = [hit.year, hit.kind, score ? `★ ${score}` : null].filter(Boolean).join(" · ");
                        return line ? <span className="text-xs text-neutral-500">{line}</span> : null;
                      })()}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {related.length > 0 && (
            <>
              <h2 className="font-serif text-xl">Related</h2>
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                {related.map((p) => (
                  <PersonCircle key={`${p.personId ?? p.tmdbId}`} href={p.personId ? `/person/?id=${p.personId}` : `/person/?tmdb=${p.tmdbId}`} name={p.name} profilePath={p.profilePath} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function PersonPage() {
  return (
    <Suspense>
      <PersonView />
    </Suspense>
  );
}
