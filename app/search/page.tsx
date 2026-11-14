// app/search/page.tsx
// Search your own log, your want-to-watch list and TMDB at once.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { previewHref, seenKey } from "@/lib/home/rows";
import type { CatalogHit } from "@/lib/ports/catalog";
import type { OwnHit } from "@/lib/ports/log";
import type { WantedItem } from "@/lib/ports/wanted";
import { services } from "@/lib/services";

const DEBOUNCE_MS = 350;

interface Found {
  query: string;
  own: OwnHit[];
  tmdb: CatalogHit[];
  problem: string | null;
}

/** Alternates movies and shows so neither crowds the other out. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function ResultRow({ href, poster, title, subtitle, badge }: {
  href: string;
  poster: string | null;
  title: string;
  subtitle: string | null;
  badge?: string | null;
}) {
  return (
    <li>
      <Link href={href} className="flex gap-3">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-12 rounded-lg" />
        ) : (
          <div className="h-[72px] w-12 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        )}
        <div className="flex flex-col justify-center text-sm">
          <span className="font-medium">{title}</span>
          <span className="text-neutral-500">{[subtitle, badge].filter(Boolean).join(" · ")}</span>
        </div>
      </Link>
    </li>
  );
}

export default function SearchPage() {
  const ready = useRequireSession();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [wanted, setWanted] = useState<WantedItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const q = query.trim();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.wanted.list(), services.log.seen()]).then(([w, s]) => {
      if (cancelled) return;
      if (w.ok) setWanted(w.value);
      if (s.ok) setSeen(new Set(s.value));
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [own, movies, shows] = await Promise.all([
        services.log.search(q, 8),
        services.catalog.search(q, "Movie"),
        services.catalog.search(q, "TV Show"),
      ]);
      if (cancelled) return;
      const tmdbError = !movies.ok ? movies.error : !shows.ok ? shows.error : null;
      setFound({
        query: q,
        own: own.ok ? own.value : [],
        tmdb: interleave(movies.ok ? movies.value : [], shows.ok ? shows.value : []),
        problem: !own.ok ? own.error : tmdbError,
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, q]);

  const wantedKeys = useMemo(
    () => new Set(wanted.flatMap((item) => (item.tmdbId === null ? [] : [`${item.category}:${item.tmdbId}`]))),
    [wanted],
  );
  const wantedMatches = useMemo(
    () => (q.length < 2 ? [] : wanted.filter((item) => item.title.toLowerCase().includes(q.toLowerCase()))),
    [wanted, q],
  );

  if (!ready) return null;

  const current = q.length >= 2 && found?.query === q ? found : null;
  const searching = q.length >= 2 && !current;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-28 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Search</h1>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A film or show"
        autoComplete="off"
        // 16px keeps iOS Safari from zooming the page when the field is focused.
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700"
      />

      {searching && <p className="text-sm text-neutral-500">Searching…</p>}
      {current?.problem && <p role="alert" className="text-sm text-red-600">{current.problem}</p>}

      {current && current.own.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">In your log</h2>
          <ul className="flex flex-col gap-3">
            {current.own.map((hit) => (
              <ResultRow
                key={hit.mediaId}
                href={`/title/?id=${hit.mediaId}`}
                poster={tmdbImageUrl(hit.posterPath, "w185")}
                title={hit.title}
                subtitle={[hit.year, hit.category].filter(Boolean).join(" · ")}
                badge={`Watched ${hit.viewings}×`}
              />
            ))}
          </ul>
        </section>
      )}

      {wantedMatches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">Want to watch</h2>
          <ul className="flex flex-col gap-3">
            {wantedMatches.map((item) => (
              <ResultRow
                key={item.mediaId}
                href={
                  item.tmdbId === null
                    ? `/title/?id=${item.mediaId}`
                    : previewHref(item.category === "TV Show" ? "TV Show" : "Movie", item.tmdbId)
                }
                poster={tmdbImageUrl(item.posterPath, "w185")}
                title={item.title}
                subtitle={item.category}
              />
            ))}
          </ul>
        </section>
      )}

      {current && current.tmdb.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">Find something new</h2>
          <ul className="flex flex-col gap-3">
            {current.tmdb.map((hit) => {
              const key = seenKey(hit.kind, hit.tmdbId);
              return (
                <ResultRow
                  key={key}
                  href={previewHref(hit.kind, hit.tmdbId)}
                  poster={hit.posterUrl}
                  title={hit.title}
                  subtitle={[hit.year, hit.kind].filter(Boolean).join(" · ")}
                  badge={seen.has(key) ? "Seen" : wantedKeys.has(key) ? "Want to watch" : null}
                />
              );
            })}
          </ul>
        </section>
      )}

      {current && !current.problem && current.own.length === 0 && current.tmdb.length === 0 && wantedMatches.length === 0 && (
        <p className="text-sm text-neutral-500">Nothing found for “{q}”.</p>
      )}

      <BottomNav />
    </main>
  );
}
