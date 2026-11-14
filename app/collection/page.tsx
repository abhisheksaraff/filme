// app/collection/page.tsx
// One collection: rename it, add titles from your log or TMDB, remove titles, or delete it.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { interleave, previewHref } from "@/lib/home/rows";
import type { CatalogHit } from "@/lib/ports/catalog";
import type { CollectionDetail } from "@/lib/ports/collections";
import type { OwnHit } from "@/lib/ports/log";
import { services } from "@/lib/services";

const DEBOUNCE_MS = 350;
const small = "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700";

interface Found {
  query: string;
  own: OwnHit[];
  tmdb: CatalogHit[];
}

function CollectionView() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");

  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.collections.get(id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDetail(res.value);
        setName(res.value.name);
      } else {
        setProblem(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  const q = query.trim();
  useEffect(() => {
    if (!ready || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [own, movies, shows] = await Promise.all([
        services.log.search(q, 6),
        services.catalog.search(q, "Movie"),
        services.catalog.search(q, "TV Show"),
      ]);
      if (cancelled) return;
      setFound({
        query: q,
        own: own.ok ? own.value : [],
        tmdb: interleave(movies.ok ? movies.value : [], shows.ok ? shows.value : []),
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, q]);

  /** Runs a change, shows any failure, and reloads the list on success. */
  async function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    setProblem(null);
    const res = await action();
    if (res.ok) {
      after?.();
      setReload((n) => n + 1);
    } else {
      setProblem(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  async function addCatalogHit(hit: CatalogHit) {
    if (!id) return;
    setBusy(true);
    const details = await services.catalog.details(hit);
    if (!details.ok) {
      setProblem(details.error);
      setBusy(false);
      return;
    }
    setBusy(false);
    await run(() => services.collections.addCatalog(id, details.value), () => setQuery(""));
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No collection selected.</main>;

  const inCollection = new Set(detail?.items.map((item) => item.mediaId));
  const current = q.length >= 2 && found?.query === q ? found : null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <BackLink fallback="/collections/" />
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {detail && (
        <>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label="Collection name"
              className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-4 py-2 font-serif text-2xl dark:border-neutral-700"
            />
            <button
              type="button"
              className={small}
              disabled={busy || !name.trim() || name.trim() === detail.name}
              onClick={() => run(() => services.collections.update(detail.id, name, detail.description))}
            >
              Rename
            </button>
          </div>

          <ul className="flex flex-col gap-3">
            {detail.items.map((item) => (
              <li key={item.mediaId} className="flex items-center gap-3">
                <Link
                  href={item.tmdbId === null ? `/title/?id=${item.mediaId}` : previewHref(item.category === "TV Show" ? "TV Show" : "Movie", item.tmdbId)}
                  className="flex flex-1 items-center gap-3"
                >
                  {item.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(item.posterPath, "w185") ?? ""} alt="" className="w-12 rounded-lg" />
                  ) : (
                    <div className="h-[72px] w-12 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="flex flex-col text-sm">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-neutral-500">{[item.year, item.category].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.title}`}
                  className={small}
                  disabled={busy}
                  onClick={() => run(() => services.collections.removeMedia(detail.id, item.mediaId))}
                >
                  ✕
                </button>
              </li>
            ))}
            {detail.items.length === 0 && <li className="text-sm text-neutral-500">Empty. Add a title below.</li>}
          </ul>

          <section className="flex flex-col gap-2">
            <h2 className="font-serif text-xl">Add a title</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your log or TMDB"
              autoComplete="off"
              className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700"
            />
            {q.length >= 2 && !current && <p className="text-sm text-neutral-500">Searching…</p>}

            <ul className="flex flex-col gap-2">
              {current?.own.map((hit) => (
                <li key={`own-${hit.mediaId}`} className="flex items-center justify-between gap-2 text-sm">
                  <span>{hit.title} <span className="text-neutral-500">· in your log</span></span>
                  <button
                    type="button"
                    className={small}
                    disabled={busy || inCollection.has(hit.mediaId)}
                    onClick={() => run(() => services.collections.addMedia(detail.id, hit.mediaId), () => setQuery(""))}
                  >
                    {inCollection.has(hit.mediaId) ? "Added" : "Add"}
                  </button>
                </li>
              ))}
              {current?.tmdb.map((hit) => (
                <li key={`${hit.kind}-${hit.tmdbId}`} className="flex items-center justify-between gap-2 text-sm">
                  <span>{hit.title} <span className="text-neutral-500">· {[hit.year, hit.kind].filter(Boolean).join(" · ")}</span></span>
                  <button type="button" className={small} disabled={busy} onClick={() => addCatalogHit(hit)}>Add</button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-xl border border-red-300 px-4 py-3 text-sm text-red-600 dark:border-red-900"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              run(() => services.collections.remove(detail.id), () => router.replace("/collections/"));
            }}
          >
            {confirmDelete ? "Tap again to delete this collection (titles are kept)" : "Delete collection"}
          </button>
        </>
      )}
    </main>
  );
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  );
}
