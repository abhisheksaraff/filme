// app/title/page.tsx
// One title and every time it has been watched, with edit, delete and undo for each viewing.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { seatLabel } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { TitleDetail } from "@/lib/ports/log";
import { services } from "@/lib/services";

const button = "rounded-xl border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700";

function TitleView() {
  const ready = useRequireSession();
  const id = useSearchParams().get("id");

  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The viewing just deleted, so it can be undone right away. */
  const [justDeleted, setJustDeleted] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.log.titleDetail(id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDetail(res.value);
        setProblem(null);
      } else {
        setProblem(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  async function change(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    const res = await action();
    if (res.ok) {
      after?.();
      setReload((n) => n + 1);
    } else {
      setProblem(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No title selected.</main>;

  const backdrop = tmdbImageUrl(detail?.backdropPath, "w780");
  const poster = tmdbImageUrl(detail?.posterPath, "w342");

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 pb-24">
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" className="h-48 w-full object-cover" />
      )}

      <div className="flex flex-col gap-5 px-6">
        <Link href="/watchlist/" className="text-sm text-neutral-500">← Back</Link>
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

        {detail && (
          <>
            <div className="flex gap-4">
              {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="w-28 rounded-lg" />
              )}
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-3xl tracking-tight">{detail.title}</h1>
                <span className="text-sm text-neutral-500">
                  {[detail.releaseDate?.slice(0, 4), detail.runtime ? `${detail.runtime} min` : null, detail.category]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
            {detail.overview && <p className="text-sm text-neutral-600 dark:text-neutral-400">{detail.overview}</p>}

            <h2 className="font-serif text-xl">
              Watched {detail.viewings.length} {detail.viewings.length === 1 ? "time" : "times"}
            </h2>

            <ul className="flex flex-col gap-4">
              {detail.viewings.map((v) => (
                <li key={v.id} className="flex flex-col gap-2 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{[v.watchedOn ?? "Date unknown", v.watchedAt].filter(Boolean).join(" · ")}</span>
                    {v.rating !== null && <span className="text-sm">★ {v.rating}</span>}
                  </div>
                  <span className="text-sm text-neutral-500">
                    {[v.venue, v.auditorium, v.primaryFormat].filter(Boolean).join(" · ")}
                  </span>
                  {v.seats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {v.seats.map((seat, i) => (
                        <span key={i} className="rounded-full border border-neutral-300 px-3 py-0.5 text-sm dark:border-neutral-700">
                          {seatLabel(seat)}
                        </span>
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
                  <div className="flex gap-2">
                    <Link href={`/entry/?id=${v.id}`} className={button}>Edit</Link>
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => change(() => services.log.deleteViewing(v.id), () => setJustDeleted(v.id))}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {detail.viewings.length === 0 && <li className="text-sm text-neutral-500">No viewings left.</li>}
            </ul>
          </>
        )}
      </div>

      {justDeleted && (
        <div className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white dark:bg-white dark:text-neutral-900">
          <span>Viewing deleted.</span>
          <span className="flex gap-4">
            <button type="button" disabled={busy} className="font-medium underline"
              onClick={() => change(() => services.log.restoreViewing(justDeleted), () => setJustDeleted(null))}>
              Undo
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setJustDeleted(null)}>✕</button>
          </span>
        </div>
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
