// app/search/page.tsx
// One search over your log, your Watchlist and TMDB. Typing, the filters and Ask AI all feed the same
// results: people first as round photos, then titles as one list.
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import PersonCircle from "@/components/PersonCircle";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { EMPTY_FILTER, hasFilter, type LogFilter } from "@/lib/domain/askLog";
import { GENRES } from "@/lib/domain/home";
import { applyFilter, describeFilter, normalize } from "@/lib/domain/search";
import type { StatRow } from "@/lib/domain/stats";
import { loadStatRows, previewHref, seenKey } from "@/lib/home/rows";
import { usePageState } from "@/lib/pageMemory";
import type { BrowseSpec, CatalogHit, CatalogKind } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import { services } from "@/lib/services";

const DEBOUNCE_MS = 350;

type Order = "default" | "newest" | "oldest" | "rating" | "az";
const ORDERS: { id: Order; label: string }[] = [
  { id: "default", label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "rating", label: "Highest rated" },
  { id: "az", label: "A–Z" },
];

const FIELD = "rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";

/** One title in the results: from your log, your Watchlist or TMDB, shown once. */
interface Item {
  key: string;
  href: string;
  poster: string | null;
  title: string;
  year: string | null;
  kind: string;
  watched: boolean;
  wanted: boolean;
  rating: number | null;
}

interface PersonItem {
  key: string;
  name: string;
  profilePath: string | null;
  href: string;
}

interface Found {
  key: string;
  hits: CatalogHit[];
  people: PersonItem[];
  problem: string | null;
}

/** The title's identity across sources: type, name and year. */
const identity = (kind: string, title: string, year: string | null) => `${kind}:${normalize(title)}:${year ?? ""}`;

/** The TMDB genre id for a genre name, tolerating a partial name like "sci-fi". */
function genreId(name: string | null): number | undefined {
  if (!name) return undefined;
  const wanted = normalize(name);
  return GENRES.find((g) => normalize(g.name) === wanted)?.id ?? GENRES.find((g) => normalize(g.name).includes(wanted) || wanted.includes(normalize(g.name)))?.id;
}

function ResultRow({ item }: { item: Item }) {
  return (
    <li>
      <Link href={item.href} className="flex gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900">
        <span className="relative shrink-0">
          {item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt="" loading="lazy" className="aspect-[2/3] w-16 rounded-xl object-cover" />
          ) : (
            <span className="block aspect-[2/3] w-16 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          )}
          {/* Top right of the poster: a grey tick once watched, a solid bookmark when on the Watchlist. */}
          {(item.watched || item.wanted) && (
            <span className="absolute right-1 top-1 flex gap-1">
              {item.watched && <span role="img" aria-label="Watched" className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-300 text-neutral-700 shadow"><Icon name="check" size={12} /></span>}
              {item.wanted && <span role="img" aria-label="On your Watchlist" className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-white shadow"><Icon name="bookmark" size={12} filled /></span>}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col justify-center text-sm">
          <span className="font-serif text-base leading-tight">{item.title}</span>
          <span className="text-neutral-500">{[item.year, item.kind, item.rating !== null ? `★ ${item.rating}` : null].filter(Boolean).join(" · ")}</span>
        </span>
      </Link>
    </li>
  );
}

function SearchView() {
  const ready = useRequireSession();
  const [query, setQuery] = usePageState("search.query", "");
  const [filter, setFilter] = usePageState<LogFilter>("search.filter", EMPTY_FILTER);
  const [order, setOrder] = usePageState<Order>("search.order", "default");
  const [filtersOpen, setFiltersOpen] = usePageState("search.filtersOpen", false);
  const [askOpen, setAskOpen] = usePageState("search.askOpen", false);
  const [question, setQuestion] = usePageState("search.question", "");
  const [asking, setAsking] = useState(false);
  const [askProblem, setAskProblem] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [wanted, setWanted] = useState<WantedItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<StatRow[]>([]);

  const q = query.trim();
  // Nothing is shown until something is typed or a filter is set, so opening Filters alone lists nothing.
  const active = q.length >= 2 || hasFilter(filter);
  // Venue, format, watch dates and rewatches exist only in your log, so TMDB has nothing to say about them.
  const logOnly = Boolean(filter.venue || filter.format || filter.dateFrom || filter.dateTo || filter.maxRating !== null || filter.rewatchesOnly);
  const kinds: CatalogKind[] = logOnly || filter.category === "Concert" || filter.category === "Live Event" ? [] : filter.category ? [filter.category] : ["Movie", "TV Show"];
  const searchKey = JSON.stringify([q, filter.category, filter.genre, filter.releaseFrom, filter.releaseTo, filter.minRating, filter.person, logOnly]);

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

  // Titles and people from TMDB, and people already in your log.
  useEffect(() => {
    if (!ready || !active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const personName = filter.person?.trim() || (q.length >= 2 ? q : "");
      const [tmdbPeople, ownPicks] = personName.length >= 2
        ? await Promise.all([services.catalog.searchPeople(personName), services.browse.searchPeople(personName)])
        : [null, null];
      const people: PersonItem[] = [];
      const taken = new Set<number>();
      for (const p of ownPicks?.ok ? ownPicks.value : []) {
        if (p.tmdbId !== null) taken.add(p.tmdbId);
        people.push({ key: `own:${p.personId ?? p.tmdbId}`, name: p.name, profilePath: p.profilePath, href: p.personId ? `/person/?id=${p.personId}` : `/person/?tmdb=${p.tmdbId}` });
      }
      for (const p of tmdbPeople?.ok ? tmdbPeople.value : []) {
        if (!taken.has(p.tmdbId)) people.push({ key: `tmdb:${p.tmdbId}`, name: p.name, profilePath: p.profilePath, href: `/person/?tmdb=${p.tmdbId}` });
      }

      const personId = filter.person && tmdbPeople?.ok ? tmdbPeople.value[0]?.tmdbId : undefined;
      const gid = genreId(filter.genre);
      const results = await Promise.all(kinds.map(async (kind) => {
        if (q.length >= 2) {
          // Typed titles come from TMDB's search, which has no filters, so they are narrowed here.
          const res = await services.catalog.search(q, kind);
          if (!res.ok) return res;
          const narrowed = res.value.filter((h) => {
            const year = Number(h.year);
            if (gid !== undefined && h.genreIds && !h.genreIds.includes(gid)) return false;
            if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
            if (filter.releaseTo !== null && (!year || year > filter.releaseTo)) return false;
            return true;
          });
          return { ok: true as const, value: narrowed };
        }
        const spec: BrowseSpec = {
          kind,
          sortBy: filter.minRating !== null ? "vote_average.desc" : "popularity.desc",
          genreId: gid,
          yearFrom: filter.releaseFrom ?? undefined,
          yearTo: filter.releaseTo ?? undefined,
          minRating: filter.minRating ?? undefined,
          minVotes: filter.minRating !== null ? 200 : undefined,
          personId,
        };
        return services.catalog.browse(spec);
      }));
      if (cancelled) return;
      const failed = results.find((r) => !r.ok);
      setFound({
        key: searchKey,
        hits: results.flatMap((r) => (r.ok ? r.value : [])),
        people: people.slice(0, 12),
        problem: failed && !failed.ok ? failed.error : null,
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `kinds` and the filter fields it reads are all folded into searchKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, searchKey]);

  async function ask() {
    const text = question.trim();
    if (text.length < 3) return;
    setAsking(true);
    setAskProblem(null);
    const res = await services.ai.askLog(text);
    if (res.ok) {
      // The question becomes ordinary filters, shown in the panel so they can be seen and changed.
      setQuery(res.value.text ?? "");
      setFilter({ ...res.value, text: null });
      setOrder(res.value.sort === "newest" ? "newest" : res.value.sort === "oldest" ? "oldest" : res.value.sort === "rating" ? "rating" : "default");
      setFiltersOpen(true);
    } else setAskProblem(res.error);
    setAsking(false);
  }

  const items = useMemo(() => {
    if (!active) return [];
    const wantedKeys = new Set(wanted.flatMap((w) => (w.tmdbId === null ? [] : [seenKey(w.category === "TV Show" ? "TV Show" : "Movie", w.tmdbId)])));
    const wantedNames = new Set(wanted.map((w) => `${w.category}:${normalize(w.title)}`));
    const out = new Map<string, Item>();

    // Your log: one entry per title, however many times it was watched.
    for (const row of applyFilter(rows, { ...filter, text: q.length >= 2 ? q : null })) {
      if (out.has(row.mediaId)) continue;
      out.set(row.mediaId, {
        key: row.mediaId,
        href: `/title/?id=${row.mediaId}`,
        poster: tmdbImageUrl(row.posterPath, "w185"),
        title: row.title,
        year: row.releaseYear ? String(row.releaseYear) : null,
        kind: row.category,
        watched: true,
        wanted: wantedNames.has(`${row.category}:${normalize(row.title)}`),
        rating: row.rating,
      });
    }
    const byIdentity = new Set([...out.values()].map((i) => identity(i.kind, i.title, i.year)));

    // Your Watchlist, when typed words match.
    if (q.length >= 2 && !logOnly) {
      for (const w of wanted) {
        if (!normalize(w.title).includes(normalize(q))) continue;
        if (filter.category && w.category !== filter.category) continue;
        if (byIdentity.has(identity(w.category, w.title, null)) || [...byIdentity].some((k) => k.startsWith(`${w.category}:${normalize(w.title)}:`))) continue;
        const kind = w.category === "TV Show" ? "TV Show" : "Movie";
        out.set(`wanted:${w.mediaId}`, {
          key: `wanted:${w.mediaId}`,
          href: w.tmdbId === null ? `/title/?id=${w.mediaId}` : previewHref(kind, w.tmdbId),
          poster: tmdbImageUrl(w.posterPath, "w185"),
          title: w.title,
          year: null,
          kind: w.category,
          watched: false,
          wanted: true,
          rating: null,
        });
      }
    }
    const covered = (kind: string, title: string, year: string | null) =>
      byIdentity.has(identity(kind, title, year)) || [...out.values()].some((i) => i.kind === kind && normalize(i.title) === normalize(title) && (i.year === null || year === null));

    // TMDB, in TMDB's order, skipping what is already listed from your own data.
    if (found?.key === searchKey) {
      for (const hit of found.hits) {
        if (covered(hit.kind, hit.title, hit.year)) continue;
        const key = seenKey(hit.kind, hit.tmdbId);
        out.set(key, {
          key,
          href: previewHref(hit.kind, hit.tmdbId),
          poster: hit.posterUrl,
          title: hit.title,
          year: hit.year,
          kind: hit.kind,
          watched: seen.has(key),
          wanted: wantedKeys.has(key),
          rating: null,
        });
      }
    }

    const list = [...out.values()];
    // Watched and saved titles come first, then the rest keep TMDB's order, unless a sort is chosen.
    const mine = (i: Item) => (i.watched || i.wanted ? 0 : 1);
    if (order === "newest") list.sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""));
    else if (order === "oldest") list.sort((a, b) => (a.year ?? "9999").localeCompare(b.year ?? "9999"));
    else if (order === "rating") list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    else if (order === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => mine(a) - mine(b));
    return list;
  }, [active, rows, filter, q, wanted, seen, found, searchKey, order, logOnly]);

  if (!ready) return null;

  const current = found?.key === searchKey ? found : null;
  const loading = active && kinds.length > 0 && !current;
  const chips = describeFilter({ ...filter, text: null });
  const set = (patch: Partial<LogFilter>) => setFilter({ ...filter, ...patch });
  const num = (v: string) => (v.trim() === "" ? null : Number(v) || null);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Search</h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A film, show, person or place"
        autoComplete="off"
        // 16px keeps iOS Safari from zooming the page when the field is focused.
        className="rounded-full bg-neutral-100 px-5 py-3 text-base dark:bg-neutral-800"
      />
      <div className="flex gap-4 text-sm">
        <button type="button" aria-pressed={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} className="flex items-center gap-1.5 text-neutral-500">
          <Icon name="filter" size={16} />{filtersOpen ? "Hide filters" : "Filters"}
        </button>
        <button type="button" aria-pressed={askOpen} onClick={() => setAskOpen((o) => !o)} className="flex items-center gap-1.5 text-neutral-500">
          <Icon name="sparkle" size={16} />Ask AI
        </button>
        {hasFilter(filter) && (
          <button type="button" onClick={() => { setFilter(EMPTY_FILTER); setOrder("default"); }} className="ml-auto text-neutral-500 underline">Clear filters</button>
        )}
      </div>

      {askOpen && (
        <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="flex flex-col gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Comedy movies from the 50s"
            className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700"
          />
          <button type="submit" disabled={asking || question.trim().length < 3} className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            {asking ? "Thinking…" : "Ask"}
          </button>
          {askProblem && <p role="alert" className="text-sm text-red-600">{askProblem}</p>}
        </form>
      )}

      {filtersOpen && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <select value={filter.category ?? ""} onChange={(e) => set({ category: (e.target.value || null) as LogFilter["category"] })} className={FIELD} aria-label="Type">
            <option value="">Any type</option>
            {["Movie", "TV Show", "Concert", "Live Event"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={filter.genre ?? ""} onChange={(e) => set({ genre: e.target.value || null })} className={FIELD} aria-label="Genre">
            <option value="">Any genre</option>
            {filter.genre && !GENRES.some((g) => g.name === filter.genre) && <option>{filter.genre}</option>}
            {GENRES.map((g) => <option key={g.id}>{g.name}</option>)}
          </select>
          <input inputMode="numeric" value={filter.releaseFrom ?? ""} onChange={(e) => set({ releaseFrom: num(e.target.value) })} placeholder="Released from (year)" aria-label="Released from" className={FIELD} />
          <input inputMode="numeric" value={filter.releaseTo ?? ""} onChange={(e) => set({ releaseTo: num(e.target.value) })} placeholder="Released to (year)" aria-label="Released to" className={FIELD} />
          <select value={filter.minRating ?? ""} onChange={(e) => set({ minRating: e.target.value ? Number(e.target.value) : null })} className={FIELD} aria-label="Minimum rating">
            <option value="">Any rating</option>
            {[5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>★ {n}+</option>)}
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value as Order)} className={FIELD} aria-label="Sort by">
            {ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input value={filter.person ?? ""} onChange={(e) => set({ person: e.target.value || null })} placeholder="Person" className={`${FIELD} col-span-2`} />
          <input value={filter.venue ?? ""} onChange={(e) => set({ venue: e.target.value || null })} placeholder="Venue (your log)" className={FIELD} />
          <input value={filter.format ?? ""} onChange={(e) => set({ format: e.target.value || null })} placeholder="Format (your log)" className={FIELD} />
          <input type="date" value={filter.dateFrom ?? ""} onChange={(e) => set({ dateFrom: e.target.value || null })} aria-label="Watched from" className={FIELD} />
          <input type="date" value={filter.dateTo ?? ""} onChange={(e) => set({ dateTo: e.target.value || null })} aria-label="Watched to" className={FIELD} />
        </div>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {chips.map((chip) => <li key={chip} className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800">{chip}</li>)}
        </ul>
      )}

      {!active && <p className="text-sm text-neutral-500">Type a title or person, set a filter, or ask AI.</p>}

      {active && current && current.people.length > 0 && (
        <ul className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" aria-label="People">
          {current.people.map((p) => <PersonCircle key={p.key} href={p.href} name={p.name} profilePath={p.profilePath} />)}
        </ul>
      )}

      {current?.problem && <p role="alert" className="text-sm text-red-600">{current.problem}</p>}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.slice(0, 80).map((item) => <ResultRow key={item.key} item={item} />)}
        </ul>
      )}

      {loading && items.length === 0 && (
        <ul className="flex flex-col gap-3" aria-label="Searching">
          {Array.from({ length: 4 }, (_, i) => <li key={i} className="skeleton h-24 rounded-2xl" />)}
        </ul>
      )}

      {active && !loading && !current?.problem && items.length === 0 && (current?.people.length ?? 0) === 0 && (
        <p className="text-sm text-neutral-500">Nothing found.</p>
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
