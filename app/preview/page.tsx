// app/preview/page.tsx
// A catalogue title you have not logged (or have): details, plus add or remove from your watchlist.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import PersonCircle from "@/components/PersonCircle";
import TitleActions from "@/components/TitleActions";
import TitleHero from "@/components/TitleHero";
import { startEntryFrom } from "@/lib/logPrefill";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { CatalogDetails, CatalogKind } from "@/lib/ports/catalog";
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

  useEffect(() => {
    if (!ready || kind === null || !Number.isInteger(id) || id <= 0) return;
    let cancelled = false;
    Promise.all([services.catalog.details({ tmdbId: id, kind }), services.wanted.status(kind, id)]).then(([d, s]) => {
      if (cancelled) return;
      if (d.ok) setDetails(d.value);
      else setProblem(d.error);
      if (s.ok) setStatus(s.value);
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
      if (res.ok) setStatus({ ...status, wanted: false });
      else setProblem(res.error);
    } else {
      const res = await services.wanted.add(details);
      if (res.ok) setStatus({ mediaId: res.value, wanted: true, logged: status.logged });
      else setProblem(res.error);
    }
    setBusy(false);
  }

  function logViewing() {
    if (!details) return;
    startEntryFrom({ category: details.category, title: details.title, tmdbId: details.tmdbId });
    router.push("/scan/");
  }

  if (!ready) return null;
  if (kind === null || !Number.isInteger(id) || id <= 0) return <main className="p-6 text-sm">No title selected.</main>;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5">
      <TitleHero
        backdropUrl={details?.backdropUrl ?? details?.posterUrl ?? null}
        posterUrl={details?.posterUrl ?? null}
        title={details?.title ?? ""}
        subtitle={details ? [details.releaseYear, details.runtime ? `${details.runtime} min` : null, details.category].filter(Boolean).join(" · ") : ""}
        loading={!details && !problem}
      />

      <div className="flex flex-col gap-5 px-5 pb-8">
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

        {details && (
          <>
            {details.genres.length > 0 && <span className="text-sm text-neutral-500">{details.genres.join(", ")}</span>}

            {status && (
              <>
                <TitleActions
                  wanted={status.wanted}
                  canBookmark
                  watched={status.logged}
                  watch={{ tmdbId: details.tmdbId, kind: details.category === "TV Show" ? "TV Show" : "Movie", title: details.title, year: details.releaseYear ? String(details.releaseYear) : null }}
                  busy={busy}
                  onToggleWanted={toggleWanted}
                  onLog={logViewing}
                />
                {status.logged && status.mediaId && (
                  <Link href={`/title/?id=${status.mediaId}`} className="self-start text-sm underline">See your viewings</Link>
                )}
              </>
            )}

            {details.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{details.overview}</p>}

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
          </>
        )}
      </div>
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
