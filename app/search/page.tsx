// app/search/page.tsx
// Search your own log, your want-to-watch list and TMDB at once.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { EMPTY_FILTER, type LogFilter } from "@/lib/domain/askLog";
import { applyFilter, describeFilter } from "@/lib/domain/search";
import type { StatRow } from "@/lib/domain/stats";
import { interleave, loadStatRows, previewHref, seenKey } from "@/lib/home/rows";
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

/** A poster card for the two-column grid. */
function PosterCard({ href, poster, title, subtitle }: { href: string; poster: string | null; title: string; subtitle: string | null }) {
  return (
    <li>
      <Link href={href} className="flex flex-col gap-1">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
        ) : (
          <div className="aspect-[2/3] w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        )}
        <span className="font-serif text-base leading-tight">{title}</span>
        {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
      </Link>
    </li>
  );
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

function SearchView() {
  const ready = useRequireSession();
  const askMode = useSearchParams().get("ask") === "1";
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [wanted, setWanted] = useState<WantedItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<StatRow[]>([]);
  const [mode, setMode] = useState<"search" | "ask">(askMode ? "ask" : "search");
  const [filter, setFilter] = useState<LogFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<LogFilter | null>(null);
  const [askProblem, setAskProblem] = useState<string | null>(null);

  const q = query.trim();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.wanted.list(), services.log.seen(), loadStatRows()]).then(([w, s, r]) => {
      if (cancelled) return;
      if (w.ok) setWanted(w.value);
      if (s.ok) setSeen(new Set(s.value));
      if (r.ok) setRows(r.value);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [movies, shows] = await Promise.all([
        services.catalog.search(q, "Movie"),
        services.catalog.search(q, "TV Show"),
      ]);
      if (cancelled) return;
      const tmdbError = !movies.ok ? movies.error : !shows.ok ? shows.error : null;
      setFound({
        query: q,
        own: [],
        tmdb: interleave(movies.ok ? movies.value : [], shows.ok ? shows.value : []),
        problem: tmdbError,
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

  // Your own log is searched here in the browser, so a typo or half a name still finds it.
  const typed = useMemo(() => (q.length < 2 ? [] : applyFilter(rows, { ...filter, text: q })), [rows, filter, q]);
  const filtered = useMemo(
    () => (mode === "ask" && asked ? applyFilter(rows, asked) : mode === "search" && filtersOpen && q.length < 2 ? applyFilter(rows, filter) : []),
    [rows, mode, asked, filter, filtersOpen, q],
  );

  async function ask() {
    const text = question.trim();
    if (text.length < 3) return;
    setAsking(true);
    setAskProblem(null);
    const res = await services.ai.askLog(text);
    if (res.ok) setAsked(res.value);
    else setAskProblem(res.error);
    setAsking(false);
  }

  if (!ready) return null;

  const current = q.length >= 2 && found?.query === q ? found : null;
  const searching = q.length >= 2 && !current;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">{mode === "ask" ? "Ask your log" : "Search"}</h1>
      <div className="flex gap-2">
        {(["search", "ask"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`rounded-full border px-4 py-1.5 text-sm ${mode === m ? "border-neutral-900 font-medium dark:border-white" : "border-neutral-300 dark:border-neutral-700"}`}>
            {m === "search" ? "Search" : "✦ Ask"}
          </button>
        ))}
      </div>

      {mode === "ask" ? (
        <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="flex flex-col gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Horror films I rated 8 or higher last year"
            className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700"
          />
          <button type="submit" disabled={asking || question.trim().length < 3} className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            {asking ? "Thinking…" : "Ask"}
          </button>
          {askProblem && <p role="alert" className="text-sm text-red-600">{askProblem}</p>}
          {asked && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {describeFilter(asked).map((chip) => <li key={chip} className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800">{chip}</li>)}
              {describeFilter(asked).length === 0 && <li className="text-neutral-500">Everything in your log</li>}
            </ul>
          )}
        </form>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A film, show, person or place"
            autoComplete="off"
            // 16px keeps iOS Safari from zooming the page when the field is focused.
            className="rounded-full bg-neutral-100 px-5 py-3 text-base dark:bg-neutral-800"
          />
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="self-start text-sm text-neutral-500">{filtersOpen ? "Hide filters" : "Filters"}</button>
          {filtersOpen && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <select value={filter.category ?? ""} onChange={(e) => setFilter({ ...filter, category: (e.target.value || null) as LogFilter["category"] })} className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" aria-label="Type">
                <option value="">Any type</option>
                {["Movie", "TV Show", "Concert", "Live Event"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={filter.minRating ?? ""} onChange={(e) => setFilter({ ...filter, minRating: e.target.value ? Number(e.target.value) : null })} className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" aria-label="Minimum rating">
                <option value="">Any rating</option>
                {[5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>★ {n}+</option>)}
              </select>
              <input value={filter.venue ?? ""} onChange={(e) => setFilter({ ...filter, venue: e.target.value || null })} placeholder="Venue" className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
              <input value={filter.genre ?? ""} onChange={(e) => setFilter({ ...filter, genre: e.target.value || null })} placeholder="Genre" className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
              <input type="date" value={filter.dateFrom ?? ""} onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value || null })} aria-label="From" className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
              <input type="date" value={filter.dateTo ?? ""} onChange={(e) => setFilter({ ...filter, dateTo: e.target.value || null })} aria-label="To" className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
            </div>
          )}
        </>
      )}

      {(filtered.length > 0 || (mode === "ask" && asked)) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">{filtered.length} {filtered.length === 1 ? "match" : "matches"}</h2>
          <ul className="flex flex-col gap-3">
            {filtered.slice(0, 60).map((row) => (
              <ResultRow key={row.id} href={`/session/?id=${row.id}`} poster={tmdbImageUrl(row.posterPath, "w185")} title={row.title}
                subtitle={[row.watchedOn, row.venue, row.rating !== null ? `★ ${row.rating}` : null].filter(Boolean).join(" · ")} />
            ))}
          </ul>
        </section>
      )}

      {mode === "search" && searching && (
        <ul className="grid grid-cols-2 gap-4" aria-label="Searching">
          {Array.from({ length: 4 }, (_, i) => <li key={i} className="skeleton aspect-[2/3] rounded-2xl" />)}
        </ul>
      )}
      {current?.problem && <p role="alert" className="text-sm text-red-600">{current.problem}</p>}

      {mode === "search" && typed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">In your log</h2>
          <ul className="flex flex-col gap-3">
            {typed.slice(0, 12).map((row) => (
              <ResultRow
                key={row.id}
                href={`/session/?id=${row.id}`}
                poster={tmdbImageUrl(row.posterPath, "w185")}
                title={row.title}
                subtitle={[row.watchedOn, row.venue, row.category].filter(Boolean).join(" · ")}
                badge={row.rating !== null ? `★ ${row.rating}` : null}
              />
            ))}
          </ul>
        </section>
      )}

      {mode === "search" && wantedMatches.length > 0 && (
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

      {mode === "search" && current && current.tmdb.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">Find something new</h2>
          <ul className="grid grid-cols-2 gap-4">
            {current.tmdb.map((hit) => {
              const key = seenKey(hit.kind, hit.tmdbId);
              return (
                <PosterCard
                  key={key}
                  href={previewHref(hit.kind, hit.tmdbId)}
                  poster={hit.posterUrl}
                  title={hit.title}
                  subtitle={[hit.year, seen.has(key) ? "Seen" : wantedKeys.has(key) ? "Want to watch" : null].filter(Boolean).join(" · ")}
                />
              );
            })}
          </ul>
        </section>
      )}

      {mode === "search" && current && !current.problem && typed.length === 0 && current.tmdb.length === 0 && wantedMatches.length === 0 && (
        <p className="text-sm text-neutral-500">Nothing found for “{q}”.</p>
      )}

    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
