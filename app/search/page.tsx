// app/search/page.tsx
// One search over your log, your Watchlist and TMDB. Typing, the filters and Ask AI all feed the same
// results: people first as round photos, then titles as one list.
"use client";

import { keepIfSame } from "@/lib/same";
import ProblemPopup from "@/components/ProblemPopup";
import { FIELD } from "@/components/ui/fields";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { searchFocus } from "@/lib/searchFocus";
import Icon from "@/components/Icon";
import PersonCircle from "@/components/PersonCircle";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { EMPTY_FILTER, hasFilter, type LogFilter } from "@/lib/domain/askLog";
import { discover } from "@/lib/ask/discover";
import { EMPTY_PLAN, hasPlan, LANGUAGE_NAMES, type AskPlan } from "@/lib/domain/askPlan";
import { GENRES } from "@/lib/domain/home";
import { applyFilter, describeFilter, normalize } from "@/lib/domain/search";
import type { StatRow } from "@/lib/domain/stats";
import { warmTitle } from "@/lib/handoff";
import { loadStatRows, previewHref, seenKey } from "@/lib/home/rows";
import { usePageState } from "@/lib/pageMemory";
import type { BrowseSpec, CatalogHit, CatalogKind } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import { services } from "@/lib/services";

const DEBOUNCE_MS = 350;
/** Merges lists by taking one from each in turn. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

const NO_MATCH = "We couldn't find a match for that.";

type Order = "default" | "newest" | "oldest" | "rating" | "az";
const ORDERS: { id: Order; label: string }[] = [
  { id: "default", label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "rating", label: "Highest rated" },
  { id: "az", label: "A–Z" },
];


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
  /** What the AI's plan resolved to: people found, names not found, and a note when it was loosened. */
  plan?: { people: { name: string; tmdbId: number }[]; missing: string[]; notice: string | null };
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
      <Link href={item.href} onClick={() => warmTitle(item.href, { title: item.title, posterUrl: item.poster, subtitle: item.year })} className="relative flex gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900">
        {/* A quiet word in the corner says it is already in your log or on your Watchlist. */}
        {(item.watched || item.wanted) && <span className="absolute right-3 top-2 text-[11px] text-neutral-500">{item.watched ? "Watched" : "Watchlist"}</span>}
        <span className="relative shrink-0">
          {item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt="" loading="lazy" className="aspect-[2/3] w-16 rounded-xl object-cover" />
          ) : (
            <span className="block aspect-[2/3] w-16 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
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
  // With Ask AI on, the same box takes a question instead of searching as you type.
  const [askOn, setAskOn] = usePageState("search.askOn", false);
  const [question, setQuestion] = usePageState("search.question", "");
  // Any title words the AI pulled out of the question; they stand in for typed text while asking.
  const [askText, setAskText] = usePageState("search.askText", "");
  // What the AI understood beyond the log filters; each part shows as a chip that can be removed.
  const [plan, setPlan] = usePageState<AskPlan>("search.plan", EMPTY_PLAN);
  const [asking, setAsking] = useState(false);
  const [askProblem, setAskProblem] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [wanted, setWanted] = useState<WantedItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<StatRow[]>([]);

  // "See all" on a person's page arrives with their TMDB id and name; the list is then their full credits.
  const params = useSearchParams();
  const idParam = Number(params.get("personId")) || null;
  const nameParam = params.get("name");
  useEffect(() => {
    if (!idParam || !nameParam) return;
    // Applied once per tap on "See all" (the person page clears the mark), so coming back from a title keeps the filters set since.
    if (sessionStorage.getItem("filme_seeall") === String(idParam)) return;
    sessionStorage.setItem("filme_seeall", String(idParam));
    Promise.resolve().then(() => {
      setFilter({ ...EMPTY_FILTER, person: nameParam });
      setQuery("");
      setAskOn(false);
      setOrder("default");
    });
    // The setters come from usePageState and are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, nameParam]);
  // A format or extra tapped on a viewing opens the search with only that set. `at` makes each tap count once.
  const formatParam = params.get("format");
  const extraParam = params.get("extra");
  const tapStamp = params.get("at");
  // Opened from Home's search pill, the field takes focus so the keyboard is up. On a computer it also takes focus unless
  // the page was opened with filters already set (from a person, a format or an extra), where the results are the point.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ready) return;
    const fromHome = searchFocus.take();
    const withFilters = Boolean(idParam || formatParam || extraParam);
    if (fromHome || (matchMedia("(pointer: fine)").matches && !withFilters)) inputRef.current?.focus({ preventScroll: true });
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if ((!formatParam && !extraParam) || !tapStamp) return;
    if (sessionStorage.getItem("filme_tap") === tapStamp) return;
    sessionStorage.setItem("filme_tap", tapStamp);
    Promise.resolve().then(() => {
      setFilter({ ...EMPTY_FILTER, format: formatParam, extra: extraParam });
      setQuery("");
      setAskOn(false);
      setOrder("default");
    });
    // The setters come from usePageState and are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatParam, extraParam, tapStamp]);
  const personTmdb = idParam && filter.person === nameParam ? idParam : null;

  const q = (askOn ? askText : query).trim();
  const planOn = askOn && hasPlan(plan);
  // Nothing is shown until something is typed or a filter is set, so opening Filters alone lists nothing.
  const active = q.length >= 2 || hasFilter(filter) || planOn;
  // Venue, format, watch dates and rewatches exist only in your log, so TMDB has nothing to say about them.
  const logOnly = Boolean(filter.venue || filter.format || filter.extra || filter.dateFrom || filter.dateTo || filter.maxRating !== null || filter.rewatchesOnly);
  const kinds: CatalogKind[] = logOnly || filter.category === "Concert" || filter.category === "Live Event" ? [] : filter.category ? [filter.category] : ["Movie", "TV Show"];
  const searchKey = JSON.stringify([planOn ? plan : null, filter.sort, q, filter.category, filter.genre, filter.releaseFrom, filter.releaseTo, filter.minRating, filter.person, logOnly, personTmdb]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.wanted.list(), services.log.seen(), loadStatRows()]).then(([w, s, r]) => {
      if (cancelled) return;
      if (w.ok) setWanted(w.value);
      if (s.ok) setSeen(new Set(s.value));
      if (r.ok) setRows((prev) => keepIfSame(prev, r.value));
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
      // A person opened with "See all" lists their whole credit list; the filters narrow it here.
      const credits = personTmdb !== null && kinds.length > 0 ? await services.catalog.personCredits(personTmdb) : null;
      const creditResult = credits
        ? credits.ok
          ? {
              ok: true as const,
              value: credits.value.filter((h) => {
                const year = Number(h.year);
                if (!kinds.includes(h.kind)) return false;
                if (gid !== undefined && h.genreIds && !h.genreIds.includes(gid)) return false;
                if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
                if (filter.releaseTo !== null && (!year || year > filter.releaseTo)) return false;
                if (filter.minRating !== null && (h.voteAverage ?? 0) < filter.minRating) return false;
                if (q.length >= 2 && !normalize(h.title).includes(normalize(q))) return false;
                return true;
              }),
            }
          : credits
        : null;
      // An AI plan looks people, themes and titles up first, then lists what fits.
      if (planOn && !creditResult) {
        const out = await discover({
          plan, filter, kinds, catalog: services.catalog, genreId,
          lookupPerson: async (name) => {
            const own = await services.browse.searchPeople(name);
            const mine = own.ok ? own.value.find((p) => p.tmdbId !== null) : undefined;
            if (mine && mine.tmdbId !== null) return { tmdbId: mine.tmdbId, name: mine.name };
            const res = await services.catalog.searchPeople(name);
            const top = res.ok ? res.value[0] : undefined;
            return top ? { tmdbId: top.tmdbId, name: top.name } : null;
          },
          isSeen: (h) => seen.has(seenKey(h.kind, h.tmdbId)),
        });
        if (cancelled) return;
        setFound({ key: searchKey, hits: out.hits, people: [], plan: { people: out.people, missing: out.missing, notice: out.notice }, problem: null });
        return;
      }
      const results = creditResult ? [creditResult] : await Promise.all(kinds.map(async (kind) => {
        if (q.length >= 2) {
          // Typed titles come from TMDB's search, which has no filters, so they are narrowed here.
          const res = await services.catalog.search(q, kind, 20);
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
        // Movies and shows are mixed, best match of each first, rather than all movies and then all shows.
        hits: interleave(results.map((r) => (r.ok ? r.value : []))),
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

  /** Switching Ask AI on or off carries what was typed over, so nothing has to be typed twice. Nothing runs until Return. */
  function toggleAsk() {
    if (askOn) setQuery(question || query);
    else setQuestion(query || question);
    setAskOn(!askOn);
  }

  async function ask() {
    const text = question.trim();
    if (text.length < 3) return;
    setAsking(true);
    setAskProblem(null);
    const res = await services.ai.askLog(text);
    if (res.ok) {
      // The question becomes ordinary filters and a plan; they show as chips, and Filters stays closed unless you open it.
      const { filter: f, plan: p } = res.value;
      setAskText(f.text ?? "");
      // People and genres live in the plan (and show as its chips) unless the question is about your own log.
      const aboutLog = Boolean(f.venue || f.format || f.extra || f.dateFrom || f.dateTo || f.maxRating !== null || f.rewatchesOnly);
      setFilter({ ...f, text: null, person: aboutLog || p.people.length === 0 ? f.person : null, genre: aboutLog || p.genres.length === 0 ? f.genre : null });
      setPlan(p);
      const by = p.sortBy ?? f.sort;
      setOrder(by === "newest" ? "newest" : by === "oldest" ? "oldest" : by === "rating" ? "rating" : "default");
      if (!hasFilter(f) && !hasPlan(p) && !f.text) setAskProblem(NO_MATCH);
    } else {
      // The typed words still search as they are; only a missing AI key keeps its own explanation.
      setAskText(text);
      setPlan(EMPTY_PLAN);
      setAskProblem(/key/i.test(res.error) ? res.error : NO_MATCH);
    }
    setAsking(false);
  }

  const items = useMemo(() => {
    if (!active) return [];
    const wantedKeys = new Set(wanted.flatMap((w) => (w.tmdbId === null ? [] : [seenKey(w.category === "TV Show" ? "TV Show" : "Movie", w.tmdbId)])));
    const wantedNames = new Set(wanted.map((w) => `${w.category}:${normalize(w.title)}`));
    const out = new Map<string, Item>();

    // Your log: one entry per title, however many times it was watched.
    // With only an AI plan (no log filter or typed words) the list is what TMDB found, not your whole log.
    const logPart = !planOn || logOnly;
    for (const row of logPart ? applyFilter(rows, { ...filter, text: q.length >= 2 ? q : null }) : []) {
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
    if (order === "newest") list.sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""));
    else if (order === "oldest") list.sort((a, b) => (a.year ?? "9999").localeCompare(b.year ?? "9999"));
    else if (order === "rating") list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    else if (order === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    // Otherwise they stay in order of how well they matched; whether you have seen one does not move it.
    return list;
  }, [active, rows, filter, q, wanted, seen, found, searchKey, order, logOnly, planOn]);

  if (!ready) return null;

  const current = found?.key === searchKey ? found : null;
  const loading = active && kinds.length > 0 && !current;
  const chips = describeFilter({ ...filter, text: null });
  const drop = (patch: Partial<AskPlan>) => setPlan({ ...plan, ...patch });
  const personLink = (name: string) => {
    const hit = current?.plan?.people.find((p) => normalize(p.name) === normalize(name));
    return hit ? `/person/?tmdb=${hit.tmdbId}` : undefined;
  };
  const planChips: { key: string; label: string; href?: string; remove: () => void }[] = !planOn ? [] : [
    ...plan.people.map((p) => ({ key: `p:${p.name}`, label: p.role === "director" ? `Directed by ${p.name}` : p.role === "writer" ? `Written by ${p.name}` : p.name, href: personLink(p.name), remove: () => drop({ people: plan.people.filter((x) => x !== p) }) })),
    ...plan.titles.map((t) => ({ key: `t:${t}`, label: t, remove: () => drop({ titles: plan.titles.filter((x) => x !== t) }) })),
    ...plan.like.map((t) => ({ key: `l:${t}`, label: `Like ${t}`, remove: () => drop({ like: plan.like.filter((x) => x !== t) }) })),
    ...plan.genres.map((g) => ({ key: `g:${g}`, label: g, remove: () => drop({ genres: plan.genres.filter((x) => x !== g) }) })),
    ...plan.languages.map((l) => ({ key: `lang:${l}`, label: LANGUAGE_NAMES[l] ?? l.toUpperCase(), remove: () => drop({ languages: plan.languages.filter((x) => x !== l) }) })),
    ...plan.countries.map((c) => ({ key: `c:${c}`, label: new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? c, remove: () => drop({ countries: plan.countries.filter((x) => x !== c) }) })),
    ...plan.keywords.map((k) => ({ key: `k:${k}`, label: k, remove: () => drop({ keywords: plan.keywords.filter((x) => x !== k) }) })),
    ...(plan.sortBy && plan.sortBy !== "popular" ? [{ key: "sort", label: plan.sortBy === "oldest" ? "Oldest first" : plan.sortBy === "newest" ? "Newest first" : "Best rated", remove: () => { drop({ sortBy: null }); setOrder("default"); } }] : []),
    ...(plan.maxRuntime !== null ? [{ key: "maxrt", label: `Under ${plan.maxRuntime >= 60 && plan.maxRuntime % 60 === 0 ? `${plan.maxRuntime / 60} h` : `${plan.maxRuntime} min`}`, remove: () => drop({ maxRuntime: null }) }] : []),
    ...(plan.minRuntime !== null ? [{ key: "minrt", label: `Over ${plan.minRuntime} min`, remove: () => drop({ minRuntime: null }) }] : []),
    ...plan.providers.map((x) => ({ key: `prov:${x}`, label: `On ${x}`, remove: () => drop({ providers: plan.providers.filter((y) => y !== x) }) })),
    ...(plan.inTheatres ? [{ key: "theatres", label: plan.inTheatres === "now" ? "In cinemas now" : "Coming soon", remove: () => drop({ inTheatres: null }) }] : []),
    ...(plan.seen === "not-seen" ? [{ key: "seen", label: "Not seen yet", remove: () => drop({ seen: "either" }) }] : plan.seen === "seen" ? [{ key: "seen", label: "Seen", remove: () => drop({ seen: "either" }) }] : []),
  ];
  const set = (patch: Partial<LogFilter>) => setFilter({ ...filter, ...patch });
  const num = (v: string) => (v.trim() === "" ? null : Number(v) || null);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Search</h1>

      {/* The same bar in both modes: Ask AI only changes what Return does. */}
      <form onSubmit={(e) => { e.preventDefault(); if (askOn) void ask(); else inputRef.current?.blur(); }} className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]"><Icon name="search" size={24} /></span>
        <input
          ref={inputRef}
          type={askOn ? "text" : "search"}
          value={askOn ? question : query}
          onChange={(e) => (askOn ? setQuestion(e.target.value) : setQuery(e.target.value))}
          maxLength={askOn ? 300 : undefined}
          placeholder="Search movies, shows, concerts…"
          autoComplete="off"
          enterKeyHint={askOn ? "go" : "search"}
          // 16px keeps iOS Safari from zooming the page when the field is focused.
          aria-busy={asking}
          className={`h-11 w-full rounded-full bg-neutral-100 pl-12 pr-5 text-base placeholder:text-sm transition-opacity dark:bg-neutral-800 ${asking ? "opacity-60" : ""}`}
        />
      </form>
      <div className="flex items-center gap-3 text-sm">
        <button type="button" aria-pressed={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} className="flex items-center gap-1.5 py-1.5 text-neutral-500">
          <Icon name="filter" size={16} />{filtersOpen ? "Hide filters" : "Filters"}
        </button>
        {/* Black with white text and icon while on, like a pressed checkbox. */}
        <button type="button" aria-pressed={askOn} onClick={toggleAsk}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${askOn ? "border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950" : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"}`}>
          <Icon name="sparkle" size={16} />Ask AI
        </button>
        {(hasFilter(filter) || planOn) && (
          <button type="button" onClick={() => { setFilter(EMPTY_FILTER); setPlan(EMPTY_PLAN); setOrder("default"); setAskText(""); }} className="ml-auto text-neutral-500">Clear filters</button>
        )}
      </div>
      <ProblemPopup message={askProblem} onClose={() => setAskProblem(null)} />

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

      {(chips.length > 0 || planChips.length > 0 || (current?.plan?.missing.length ?? 0) > 0) && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {chips.map((chip) => <li key={chip} className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800">{chip}</li>)}
          {/* Each part of the plan can be taken out; the list then updates without asking the AI again. */}
          {planChips.map((c) => (
            <li key={c.key} className="flex items-center gap-1 rounded-full bg-neutral-950 py-1 pl-3 pr-1 text-white dark:bg-white dark:text-neutral-950">
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/15"><Icon name="close" size={11} /></button>
            </li>
          ))}
          {current?.plan?.missing.map((m) => <li key={`missing-${m}`} className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-500 dark:bg-neutral-800">Couldn&apos;t find {m}</li>)}
        </ul>
      )}
      {current?.plan?.notice && <p className="text-sm text-neutral-500">{current.plan.notice}</p>}


      {active && current && current.people.length > 0 && (
        <ul className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" aria-label="People">
          {current.people.map((p) => <PersonCircle key={p.key} href={p.href} name={p.name} profilePath={p.profilePath} />)}
        </ul>
      )}

      <ProblemPopup message={current?.problem} onClose={() => setFound((f) => (f ? { ...f, problem: null } : f))} />

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.slice(0, personTmdb ? 400 : 80).map((item) => <ResultRow key={item.key} item={item} />)}
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
