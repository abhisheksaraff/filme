// app/preview/page.tsx
// A catalogue title you have not logged (or have): details, plus add or remove from want to watch.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import { startEntryFrom } from "@/lib/logPrefill";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { CatalogDetails, CatalogKind } from "@/lib/ports/catalog";
import type { TitleStatus } from "@/lib/ports/wanted";
import { services } from "@/lib/services";

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
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 pb-12">
      {details?.backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={details.backdropUrl} alt="" className="h-48 w-full object-cover" />
      )}

      <div className="flex flex-col gap-5 px-6 pt-4">
        <BackLink />
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        {!details && !problem && <p className="text-sm text-neutral-500">Loading…</p>}

        {details && (
          <>
            <div className="flex gap-4">
              {details.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.posterUrl} alt="" className="w-28 rounded-lg" />
              )}
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-3xl tracking-tight">{details.title}</h1>
                <span className="text-sm text-neutral-500">
                  {[details.releaseYear, details.runtime ? `${details.runtime} min` : null, details.category]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {details.genres.length > 0 && <span className="text-sm text-neutral-500">{details.genres.join(", ")}</span>}
              </div>
            </div>

            {status && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={toggleWanted}
                  className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                >
                  {status.wanted ? "Remove from want to watch" : "Want to watch"}
                </button>
                <button
                  type="button"
                  onClick={logViewing}
                  className="rounded-xl border border-neutral-300 px-5 py-3 text-base dark:border-neutral-700"
                >
                  Log a viewing
                </button>
                {status.logged && status.mediaId && (
                  <Link href={`/title/?id=${status.mediaId}`} className="text-sm underline">
                    You have watched this. See your viewings.
                  </Link>
                )}
              </div>
            )}

            {details.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{details.overview}</p>}
            {details.directors.length > 0 && (
              <p className="text-sm">
                <span className="text-neutral-500">{details.category === "TV Show" ? "Created by " : "Directed by "}</span>
                {details.directors.join(", ")}
              </p>
            )}
            {details.cast.length > 0 && (
              <p className="text-sm">
                <span className="text-neutral-500">Cast </span>
                {details.cast.join(", ")}
              </p>
            )}
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
