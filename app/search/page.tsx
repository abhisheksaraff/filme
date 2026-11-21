// app/search/page.tsx
// One search over your log, your Watchlist and TMDB. Typing, the filters and Ask AI all feed the same
// results: people first as round photos, then titles as one list.
"use client";

import { keepIfSame } from "@/lib/same";
import ProblemPopup from "@/components/ProblemPopup";
import { FIELD_SM as FIELD } from "@/components/ui/fields";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchFocus } from "@/lib/searchFocus";
import Icon from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import PersonCircle from "@/components/PersonCircle";
import SuggestTags, { type TagItem } from "@/components/SuggestTags";
import { COUNTRY_ADJECTIVES, COUNTRY_CODES, LANGUAGE_CODES, countryName, languageName } from "@/lib/domain/tagLists";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { EMPTY_FILTER, hasFilter, type LogFilter } from "@/lib/domain/askLog";
import { discover } from "@/lib/ask/discover";
import { EMPTY_PLAN, hasPlan, LANGUAGE_NAMES, type AskPlan } from "@/lib/domain/askPlan";
import { GENRES } from "@/lib/domain/home";
import { applyFilter, fuzzyMatches, normalize } from "@/lib/domain/search";
import { hasMoreAfter, placeIn, type SeasonCount } from "@/lib/domain/tv";
import { yearChoices } from "@/lib/domain/years";
import { scoreKey } from "@/lib/ports/ratings";
import type { StatRow } from "@/lib/domain/stats";
import { warmTitle } from "@/lib/handoff";
import { loadStatRows, previewHref, seenKey } from "@/lib/home/rows";
import { usePageState } from "@/lib/pageMemory";
import type { BrowseSpec, CatalogHit, CatalogKind } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import StatusBadge from "@/components/StatusBadge";
import { services } from "@/lib/services";
import { formatScore } from "@/lib/domain/score";
import DateField from "@/components/ui/DateField";
import ClearX from "@/components/ui/ClearX";
import PickSelect from "@/components/ui/PickSelect";
import SuggestInput from "@/components/ui/SuggestInput";
import { FORMAT_ADDONS, PRIMARY_FORMATS } from "@/lib/domain/formats";

const DEBOUNCE_MS = 350;
/** Merges lists by taking one from each in turn. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

const NO_MATCH = "We couldn't find a match for that.";

type Order = "default" | "newest" | "oldest" | "rating" | "lowest" | "az" | "za";
const ORDERS: { id: Order; label: string }[] = [
  { id: "default", label: "Best match" },
  { id: "newest", label: "Newest release" },
  { id: "oldest", label: "Oldest release" },
  { id: "rating", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
];

/** Country and language suggestions, built once: the name typed matches ("germany") and so does the adjective ("german"). */
const COUNTRY_TAGS: TagItem[] = COUNTRY_CODES.map((c) => ({ id: c, label: countryName(c), alias: COUNTRY_ADJECTIVES[c] }));
const LANGUAGE_TAGS: TagItem[] = LANGUAGE_CODES.map((c) => ({ id: c, label: languageName(c) }));
const PROVIDER_TAGS: TagItem[] = ["Netflix", "Prime Video", "Disney+", "Max", "Apple TV+", "Hulu", "Crave", "Paramount+"].map((n) => ({ id: n, label: n }));
const GENRE_TAGS: TagItem[] = GENRES.map((g) => ({ id: g.name, label: g.name }));


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
  /** The IMDb score (TMDB's when there is none), shown after the type; null leaves it out. */
  score: number | null;
  /** Where its score is looked up: the saved title, or the kind and TMDB id. Null for things with none. */
  scoreItem: { mediaId: string | null; kind: "Movie" | "TV Show"; tmdbId: number | null; tmdbRating: number | null; releaseDate: string | null } | null;
  /** Where it ranks when several countries, languages or genres were asked for; 0 is the best group. */
  group: number;
  /** Share of a show's episodes logged, from 0 to 1, when only part of it is; "pending" until that is known, so no eye shows too early. */
  progress?: number | "pending";
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
  plan?: { people: { name: string; tmdbId: number; profilePath: string | null }[]; missing: string[]; notice: string | null };
  hits: CatalogHit[];
  groups?: Record<string, number>;
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

/** Shows already looked up for their episode count, so each is asked about once per visit. */
const askedTotals = new Set<string>();
const totalKey = (title: string, year: string | null) => `${normalize(title)}:${year ?? ""}`;

function ResultRow({ item }: { item: Item }) {
  return (
    <li>
      <Link href={item.href} onClick={() => warmTitle(item.href, { title: item.title, posterUrl: item.poster, subtitle: item.year })} className="relative flex gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900">
        {/* Round badges on the poster's top-right corner say it is in your log, on your Watchlist, or both. */}
        <span className="relative block w-20 shrink-0 md:w-24">
          {/* Spans the poster so each circle can take its size from the poster's width. */}
          {(item.watched || item.wanted) && (
            <span className="absolute inset-x-0 top-0 z-10 flex justify-end gap-[3%] p-[4%]">
              {/* The ring wins when a show is both partly watched and on the Watchlist. */}
              {item.wanted && typeof item.progress !== "number" && <StatusBadge kind="watchlist" />}
              {item.watched && item.progress !== "pending" && <StatusBadge kind="watched" progress={item.progress} />}
            </span>
          )}
          {item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
          ) : (
            <span className="block aspect-[2/3] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          )}
        </span>
        <span className="flex min-w-0 flex-col justify-center text-sm">
          <span className="font-serif text-base leading-tight">{item.title}</span>
          <span className="text-neutral-500">{[item.year, item.kind, item.score !== null ? `★ ${formatScore(item.score)}` : null].filter(Boolean).join(" · ")}</span>
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
  // Searching inside one list only: what you have watched, or your Watchlist. Opened by the search button on those pages.
  const [scope, setScope] = usePageState<"watched" | "watchlist" | "both" | null>("search.scope", null);
  // IMDb scores (the catalogue's when there is none) for the titles listed, looked up in the background.
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const requested = useRef(new Set<string>());
  // How many episodes each season of a show has aired, for the progress ring on a show you are partway through.
  const [totals, setTotals] = useState<Record<string, SeasonCount[]>>({});
  // Shows whose episode count has been looked for, found or not.
  const [doneTotals, setDoneTotals] = useState<Set<string>>(new Set());
  const progressOf = useCallback((_id: string, kind: string, title: string, year: string | null): number | "pending" | undefined => {
    if (kind !== "TV Show") return undefined;
    const key = totalKey(title, year);
    const aired = totals[key];
    // Until the count is known the eye is held back, so a half-watched show never flashes as finished.
    if (!aired) return doneTotals.has(key) ? undefined : "pending";
    // Where you are comes from the viewing added last (rows are oldest first); a whole series logged at once is the end.
    const mine = rows.filter((r) => r.category === "TV Show" && normalize(r.title) === normalize(title) && (!year || !r.releaseYear || String(r.releaseYear) === year));
    const place = placeIn(mine.at(-1) ?? null, aired);
    return hasMoreAfter(place) ? place.done / place.total : undefined;
  }, [rows, totals, doneTotals]);

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
  const scopeParam = params.get("in");
  useEffect(() => {
    if ((scopeParam !== "watched" && scopeParam !== "watchlist") || !tapStamp) return;
    if (sessionStorage.getItem("filme_scope") === tapStamp) return;
    sessionStorage.setItem("filme_scope", tapStamp);
    Promise.resolve().then(() => {
      setScope(scopeParam);
      setFilter(EMPTY_FILTER);
      setPlan(EMPTY_PLAN);
      setQuery("");
      setAskText("");
      setAskOn(false);
      setOrder("default");
    });
    // The setters come from usePageState and are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParam, tapStamp]);
  const personTmdb = idParam && filter.person === nameParam ? idParam : null;

  const q = (askOn ? askText : query).trim();
  // The typed tags and the AI's answer are the same plan, so both work whether or not Ask AI is switched on.
  const planOn = hasPlan(plan);
  // Nothing is shown until something is typed or a filter is set, so opening Filters alone lists nothing.
  const active = q.length >= 2 || hasFilter(filter) || planOn || scope !== null;
  // Inside a list, the parts of a plan that your own log can answer (people, genres, languages) are checked against the log
  // itself. Anything else (countries, themes, titles) is looked up on TMDB and the list keeps what appears there too.
  const planLookup = planOn && (scope === "watchlist" || scope === "both" || plan.countries.length > 0 || plan.keywords.length > 0 || plan.titles.length > 0 || plan.like.length > 0 || plan.providers.length > 0 || plan.inTheatres !== null || plan.maxRuntime !== null || plan.minRuntime !== null);
  const needsLookup = scope === null ? planOn : planLookup;
  // Venue, format, watch dates and rewatches exist only in your log, so TMDB has nothing to say about them.
  const logOnly = Boolean(filter.venue || filter.format || filter.extra || filter.dateFrom || filter.dateTo || filter.maxRating !== null || filter.rewatchesOnly);
  const kinds: CatalogKind[] = scope !== null ? [] : logOnly || filter.category === "Concert" || filter.category === "Live Event" ? [] : filter.category ? [filter.category] : ["Movie", "TV Show"];
  const searchKey = JSON.stringify([planOn ? plan : null, filter.sort, q, scope, filter.category, filter.genre, filter.releaseFrom, filter.releaseTo, filter.minRating, filter.person, logOnly, personTmdb]);

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
    if (!ready || !active || (scope !== null && !needsLookup)) return;
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
      if (needsLookup && !creditResult) {
        const out = await discover({
          plan, filter, kinds: scope !== null ? (filter.category === "Movie" || filter.category === "TV Show" ? [filter.category] : ["Movie", "TV Show"]) : kinds, catalog: services.catalog, genreId,
          lookupPerson: async (name) => {
            const own = await services.browse.searchPeople(name);
            const mine = own.ok ? own.value.find((p) => p.tmdbId !== null) : undefined;
            if (mine && mine.tmdbId !== null) return { tmdbId: mine.tmdbId, name: mine.name, profilePath: mine.profilePath };
            const res = await services.catalog.searchPeople(name);
            const top = res.ok ? res.value[0] : undefined;
            return top ? { tmdbId: top.tmdbId, name: top.name, profilePath: top.profilePath } : null;
          },
          isSeen: (h) => seen.has(seenKey(h.kind, h.tmdbId)),
        });
        if (cancelled) return;
        setFound({ key: searchKey, hits: out.hits, groups: out.groups, people: [], plan: { people: out.people, missing: out.missing, notice: out.notice }, problem: null });
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
      setFilter({ ...f, text: null, person: aboutLog || p.people.length === 0 ? f.person : null, genre: aboutLog || p.genres.length === 0 ? f.genre : null, maxRating: f.minRating !== null && f.maxRating !== null && f.minRating > f.maxRating ? null : f.maxRating });
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
    const logPart = scope === "watched" || scope === "both" ? true : scope === "watchlist" ? false : !planOn || logOnly;
    // Inside Watched, what your log can answer itself is checked against it; the rest must also appear in TMDB's answer.
    const fromTmdb = found?.key === searchKey ? found : null;
    const members = (scope === "watched" || scope === "both") && planLookup ? new Set((fromTmdb?.hits ?? []).map((h) => identity(h.kind, h.title, h.year))) : null;
    const nameIn = (pool: string[], name: string) => pool.some((p) => normalize(p) === normalize(name) || fuzzyMatches(name, p));
    const rowFits = (row: StatRow) => {
      if ((scope !== "watched" && scope !== "both") || !planOn) return true;
      for (const p of plan.people) {
        const pool = p.role === "director" ? row.directors : p.role === "cast" ? [...row.actors, ...row.performers] : p.role === "writer" ? null : [...row.directors, ...row.actors, ...row.performers];
        if (pool && !nameIn(pool, p.name)) return false;
      }
      for (const g of plan.genres) if (!row.genres.some((x) => normalize(x).includes(normalize(g)))) return false;
      if (plan.languages.length > 0 && !plan.languages.some((c) => row.language !== null && [normalize(c), normalize(languageName(c))].includes(normalize(row.language)))) return false;
      if (members && !members.has(identity(row.category, row.title, row.releaseYear ? String(row.releaseYear) : null))) return false;
      return true;
    };
    for (const row of logPart ? applyFilter(rows, { ...filter, text: q.length >= 2 ? q : null }).filter(rowFits) : []) {
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
        score: null,
        scoreItem: row.category === "Movie" || row.category === "TV Show" ? { mediaId: row.mediaId, kind: row.category, tmdbId: null, tmdbRating: null, releaseDate: row.releaseYear ? String(row.releaseYear) : null } : null,
        group: 0,
        progress: progressOf(row.mediaId, row.category, row.title, row.releaseYear ? String(row.releaseYear) : null),
      });
    }
    const byIdentity = new Set([...out.values()].map((i) => identity(i.kind, i.title, i.year)));

    // Your Watchlist: when typed words match, or all of it when searching inside it.
    if (scope === "watchlist" || scope === "both" || (scope === null && q.length >= 2 && !logOnly)) {
      const inTmdb = (scope === "watchlist" || scope === "both") && planOn ? new Set((fromTmdb?.hits ?? []).map((h) => `${h.kind}:${h.tmdbId}`)) : null;
      for (const w of wanted) {
        if (q.length >= 2 && !normalize(w.title).includes(normalize(q))) continue;
        if (filter.category && w.category !== filter.category) continue;
        if (inTmdb && (w.tmdbId === null || !inTmdb.has(`${w.category}:${w.tmdbId}`))) continue;
        if (scope === null && (byIdentity.has(identity(w.category, w.title, null)) || [...byIdentity].some((k) => k.startsWith(`${w.category}:${normalize(w.title)}:`)))) continue;
        const kind = w.category === "TV Show" ? "TV Show" : "Movie";
        out.set(`wanted:${w.mediaId}`, {
          key: `wanted:${w.mediaId}`,
          href: w.tmdbId === null ? `/title/?id=${w.mediaId}` : previewHref(kind, w.tmdbId),
          poster: tmdbImageUrl(w.posterPath, "w185"),
          title: w.title,
          year: w.releaseDate ? w.releaseDate.slice(0, 4) : null,
          kind: w.category,
          watched: false,
          wanted: true,
          rating: null,
          score: null,
          scoreItem: w.tmdbId !== null && (w.category === "Movie" || w.category === "TV Show") ? { mediaId: null, kind: w.category, tmdbId: w.tmdbId, tmdbRating: null, releaseDate: w.releaseDate } : null,
          group: 0,
        });
      }
    }
    const covered = (kind: string, title: string, year: string | null) =>
      byIdentity.has(identity(kind, title, year)) || [...out.values()].some((i) => i.kind === kind && normalize(i.title) === normalize(title) && (i.year === null || year === null));

    // TMDB, in TMDB's order, skipping what is already listed from your own data.
    if (scope === null && found?.key === searchKey) {
      for (const hit of found.hits) {
        if (covered(hit.kind, hit.title, hit.year)) continue;
        // Typed words narrow what a plan found, so a title typed beside the tags still has to match.
        if (planOn && !askOn && q.length >= 2 && !normalize(hit.title).includes(normalize(q))) continue;
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
          score: hit.voteAverage ? Math.round(hit.voteAverage * 10) / 10 : null,
          scoreItem: { mediaId: null, kind: hit.kind, tmdbId: hit.tmdbId, tmdbRating: hit.voteAverage ?? null, releaseDate: hit.releaseDate ?? null },
          group: found.groups?.[key] ?? 0,
          progress: seen.has(key) ? progressOf(key, hit.kind, hit.title, hit.year) : undefined,
        });
      }
    }

    // The IMDb score (the catalogue's until it arrives) replaces what each title came with.
    const list = [...out.values()].map((i) => ({ ...i, score: (i.scoreItem ? scores.get(scoreKey(i.scoreItem)) : undefined) ?? i.score }));
    // The chosen sort applies inside each group (titles matching the most typed countries, languages and genres first).
    const within = (a: Item, b: Item) =>
      order === "newest" ? (b.year ?? "").localeCompare(a.year ?? "")
      : order === "oldest" ? (a.year ?? "9999").localeCompare(b.year ?? "9999")
      : order === "rating" ? (b.score ?? -1) - (a.score ?? -1)
      // Unrated titles go last, whichever way round.
      : order === "lowest" ? (a.score ?? 99) - (b.score ?? 99)
      : order === "az" ? a.title.localeCompare(b.title)
      : order === "za" ? b.title.localeCompare(a.title)
      : 0;
    // Otherwise they stay in order of how well they matched; whether you have seen one does not move it.
    return list.map((item, index) => ({ item, index })).sort((a, b) => a.item.group - b.item.group || within(a.item, b.item) || a.index - b.index).map((x) => x.item);
  }, [active, rows, filter, q, wanted, seen, found, searchKey, order, logOnly, planOn, askOn, progressOf, scope, planLookup, plan, scores]);

  // IMDb scores for what is listed: saved ones come back at once, and a few missing ones are looked up in the background.
  useEffect(() => {
    const fresh = items.slice(0, 40).filter((i) => i.scoreItem && !requested.current.has(i.key));
    if (fresh.length === 0) return;
    for (const i of fresh) requested.current.add(i.key);
    void services.ratings
      .scores(fresh.flatMap((i) => (i.scoreItem ? [i.scoreItem] : [])), { fill: 10, onScore: (key, score) => setScores((m) => new Map(m).set(key, score)) })
      .then((m) => setScores((now) => new Map([...m, ...now])));
  }, [items]);

  // The aired episodes per season of any show in the results you have logged: saved per show, so only a show with a new episode is asked about again.
  useEffect(() => {
    const shows = items.filter((i) => i.kind === "TV Show" && i.watched).slice(0, 60).filter((i) => !askedTotals.has(totalKey(i.title, i.year)));
    if (shows.length === 0) return;
    for (const show of shows) askedTotals.add(totalKey(show.title, show.year));
    void services.progress.airedSeasons(shows.map((i) => ({ title: i.title, year: i.year, tmdbId: i.key.startsWith("TV Show:") ? Number(i.key.split(":")[1]) || null : null }))).then((map) => {
      if (map.size > 0) setTotals((t) => ({ ...t, ...Object.fromEntries(map) }));
    }).finally(() => setDoneTotals((d) => new Set([...d, ...shows.map((i) => totalKey(i.title, i.year))])));
  }, [items]);

  if (!ready) return null;

  const current = found?.key === searchKey ? found : null;
  const loading = active && (kinds.length > 0 || (scope !== null && needsLookup)) && !current;
  // Every part of the filter shows as a chip with an x, so a date or a venue can be taken out without clearing the rest.
  const filterChips: { key: string; label: string; remove: () => void }[] = [
    ...(filter.category ? [{ key: "category", label: filter.category, remove: () => set({ category: null }) }] : []),
    ...(filter.genre ? [{ key: "genre", label: filter.genre, remove: () => set({ genre: null }) }] : []),
    ...(filter.person ? [{ key: "person", label: `with ${filter.person}`, remove: () => set({ person: null }) }] : []),
    ...(filter.venue ? [{ key: "venue", label: `at ${filter.venue}`, remove: () => set({ venue: null }) }] : []),
    ...(filter.format ? [{ key: "format", label: filter.format, remove: () => set({ format: null }) }] : []),
    ...(filter.extra ? [{ key: "extra", label: filter.extra, remove: () => set({ extra: null }) }] : []),
    ...(filter.minRating !== null ? [{ key: "min", label: `★ ${formatScore(filter.minRating)}+`, remove: () => set({ minRating: null }) }] : []),
    ...(filter.maxRating !== null ? [{ key: "max", label: `★ up to ${formatScore(filter.maxRating)}`, remove: () => set({ maxRating: null }) }] : []),
    ...(filter.releaseFrom !== null || filter.releaseTo !== null ? [{ key: "released", label: filter.releaseFrom === filter.releaseTo ? `${filter.releaseFrom}` : `${filter.releaseFrom ?? "…"}–${filter.releaseTo ?? "…"}`, remove: () => set({ releaseFrom: null, releaseTo: null }) }] : []),
    ...(filter.dateFrom ? [{ key: "from", label: `from ${filter.dateFrom}`, remove: () => set({ dateFrom: null }) }] : []),
    ...(filter.dateTo ? [{ key: "to", label: `to ${filter.dateTo}`, remove: () => set({ dateTo: null }) }] : []),
    ...(filter.rewatchesOnly ? [{ key: "rewatch", label: "rewatches", remove: () => set({ rewatchesOnly: false }) }] : []),
  ];
  const drop = (patch: Partial<AskPlan>) => setPlan({ ...plan, ...patch });
  const personLink = (name: string) => {
    const hit = current?.plan?.people.find((p) => normalize(p.name) === normalize(name));
    return hit ? `/person/?tmdb=${hit.tmdbId}` : undefined;
  };
  const planChips: { key: string; label: string; href?: string; image?: string | null; remove: () => void }[] = !planOn ? [] : [
    ...plan.people.map((p) => ({ key: `p:${p.name}`, label: p.role === "director" ? `Directed by ${p.name}` : p.role === "writer" ? `Written by ${p.name}` : p.name, href: p.tmdbId ? `/person/?tmdb=${p.tmdbId}` : personLink(p.name), image: p.profilePath ?? current?.plan?.people.find((x) => x.tmdbId === p.tmdbId)?.profilePath ?? null, remove: () => drop({ people: plan.people.filter((x) => x !== p) }) })),
    ...plan.titles.map((t) => ({ key: `t:${t}`, label: t, remove: () => drop({ titles: plan.titles.filter((x) => x !== t) }) })),
    ...plan.like.map((t) => ({ key: `l:${t}`, label: `Like ${t}`, remove: () => drop({ like: plan.like.filter((x) => x !== t) }) })),
    ...plan.genres.map((g) => ({ key: `g:${g}`, label: g, remove: () => drop({ genres: plan.genres.filter((x) => x !== g) }) })),
    ...plan.languages.map((l) => ({ key: `lang:${l}`, label: LANGUAGE_NAMES[l] ?? l.toUpperCase(), remove: () => drop({ languages: plan.languages.filter((x) => x !== l) }) })),
    ...plan.countries.map((c) => ({ key: `c:${c}`, label: countryName(c), remove: () => drop({ countries: plan.countries.filter((x) => x !== c) }) })),
    ...plan.keywords.map((k) => ({ key: `k:${k}`, label: k, remove: () => drop({ keywords: plan.keywords.filter((x) => x !== k) }) })),
    ...(plan.sortBy && plan.sortBy !== "popular" ? [{ key: "sort", label: plan.sortBy === "oldest" ? "Oldest release" : plan.sortBy === "newest" ? "Newest release" : "Best rated", remove: () => { drop({ sortBy: null }); setOrder("default"); } }] : []),
    ...(plan.maxRuntime !== null ? [{ key: "maxrt", label: `Under ${plan.maxRuntime >= 60 && plan.maxRuntime % 60 === 0 ? `${plan.maxRuntime / 60} h` : `${plan.maxRuntime} min`}`, remove: () => drop({ maxRuntime: null }) }] : []),
    ...(plan.minRuntime !== null ? [{ key: "minrt", label: `Over ${plan.minRuntime} min`, remove: () => drop({ minRuntime: null }) }] : []),
    ...plan.providers.map((x) => ({ key: `prov:${x}`, label: `On ${x}`, remove: () => drop({ providers: plan.providers.filter((y) => y !== x) }) })),
    ...(plan.inTheatres ? [{ key: "theatres", label: plan.inTheatres === "now" ? "In cinemas now" : "Coming soon", remove: () => drop({ inTheatres: null }) }] : []),
    ...(plan.seen === "not-seen" ? [{ key: "seen", label: "Not seen yet", remove: () => drop({ seen: "either" }) }] : plan.seen === "seen" ? [{ key: "seen", label: "Seen", remove: () => drop({ seen: "either" }) }] : []),
  ];
  // What sits under each tag field while the filters are open: the same picks as the black chips outside, each with its x.
  const tagsOf = (prefix: string, idOf: (value: string) => string = (v) => v): TagItem[] =>
    planChips.filter((c) => c.key.startsWith(prefix)).map((c) => ({ id: idOf(c.key.slice(prefix.length)), label: c.label, image: c.image }));
  const removeTag = (prefix: string, id: string, idOf: (value: string) => string = (v) => v) => planChips.find((c) => c.key.startsWith(prefix) && idOf(c.key.slice(prefix.length)) === id)?.remove();
  const peopleTags: TagItem[] = plan.people.flatMap((p) => {
    const chip = planChips.find((c) => c.key === `p:${p.name}`);
    return chip ? [{ id: String(p.tmdbId ?? p.name), label: chip.label, image: chip.image }] : [];
  });
  const lower = (v: string) => v.toLowerCase();
  // With the filters open, every pick shows inside the card (under its field or in the field itself); only the ones with no field of
  // their own stay out here. With the card closed, all of them sit out here as before.
  const outsideOthers = !filtersOpen;
  const outsideChips = planChips.filter((c) => !filtersOpen || c.key.startsWith("t:") || c.key.startsWith("l:"));
  // Release years: a few ahead for films not out yet; a year set some other way (by Ask AI) is kept in the list so the box can show it.
  const releaseYears = yearChoices(5);
  const yearsWith = (v: number | null) => (v !== null && !releaseYears.includes(v) ? [v, ...releaseYears] : releaseYears);
  const set = (patch: Partial<LogFilter>) => setFilter({ ...filter, ...patch });
  const num = (v: string) => (v.trim() === "" ? null : Number(v) || null);
  const minutes = (v: string) => {
    const n = num(v);
    return n === null ? null : Math.min(600, Math.max(1, Math.round(n)));
  };
  const inWatched = scope === "watched" || scope === "both";
  const inWatchlist = scope === "watchlist" || scope === "both";
  // Watched and Watchlist can be on together (either list); "not watched yet" and Watched cancel each other out.
  const toggleList = (which: "watched" | "watchlist") => {
    const watched = which === "watched" ? !inWatched : inWatched;
    const wishlist = which === "watchlist" ? !inWatchlist : inWatchlist;
    if (which === "watched" && watched && plan.seen === "not-seen") drop({ seen: "either" });
    setScope(watched && wishlist ? "both" : watched ? "watched" : wishlist ? "watchlist" : null);
  };
  const toggleNotSeen = () => {
    if (plan.seen === "not-seen") return drop({ seen: "either" });
    drop({ seen: "not-seen" });
    if (scope === "watched") setScope(null);
    else if (scope === "both") setScope("watchlist");
  };
  const pill = (on: boolean) => `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${on ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Search</h1>

      {/* The same bar in both modes: Ask AI only changes what Return does. Ask AI and Filters are round buttons beside it, black while on. */}
      <div className="flex items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); if (askOn) void ask(); else inputRef.current?.blur(); }} className="relative min-w-0 flex-1">
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
            className={`h-11 w-full rounded-full bg-neutral-100 pl-12 pr-11 text-base placeholder:text-sm transition-opacity [&::-webkit-search-cancel-button]:hidden dark:bg-neutral-800 ${asking ? "opacity-60" : ""}`}
          />
          {(askOn ? question : query) !== "" && <ClearX label="search" onClear={() => { if (askOn) setQuestion(""); else setQuery(""); inputRef.current?.focus(); }} />}
        </form>
        <RoundButton icon="sparkle" label="Ask AI" pressed={askOn} onClick={toggleAsk} />
        <RoundButton icon="filter" label={filtersOpen ? "Hide filters" : "Filters"} pressed={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} />
      </div>
      <ProblemPopup message={askProblem} onClose={() => setAskProblem(null)} />

      {filtersOpen && (
        // The options sit in one rounded card with a soft shadow, like a Watched card; the chips for what is set stay below it.
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]">
          {/* The row is always there, so the pill appearing never pushes the options down. */}
          <div className="flex h-7 justify-end">
            {(hasFilter(filter) || planOn || scope !== null) && (
              <button type="button" onClick={() => { setScope(null); setFilter(EMPTY_FILTER); setPlan(EMPTY_PLAN); setOrder("default"); setAskText(""); }} className="rounded-full bg-neutral-100 px-3 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">Clear filters</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={inWatched} onClick={() => toggleList("watched")} className={pill(inWatched)}>In Watched{inWatched && <Icon name="close" size={12} />}</button>
              <button type="button" aria-pressed={inWatchlist} onClick={() => toggleList("watchlist")} className={pill(inWatchlist)}>In Watchlist{inWatchlist && <Icon name="close" size={12} />}</button>
              <button type="button" aria-pressed={plan.seen === "not-seen"} onClick={toggleNotSeen} className={pill(plan.seen === "not-seen")}>Not watched yet{plan.seen === "not-seen" && <Icon name="close" size={12} />}</button>
              <button type="button" aria-pressed={filter.rewatchesOnly} onClick={() => set({ rewatchesOnly: !filter.rewatchesOnly })} className={pill(filter.rewatchesOnly)}>Rewatches only{filter.rewatchesOnly && <Icon name="close" size={12} />}</button>
              <button type="button" aria-pressed={plan.inTheatres === "now"} onClick={() => drop({ inTheatres: plan.inTheatres === "now" ? null : "now" })} className={pill(plan.inTheatres === "now")}>In cinemas now{plan.inTheatres === "now" && <Icon name="close" size={12} />}</button>
              <button type="button" aria-pressed={plan.inTheatres === "soon"} onClick={() => drop({ inTheatres: plan.inTheatres === "soon" ? null : "soon" })} className={pill(plan.inTheatres === "soon")}>Coming soon{plan.inTheatres === "soon" && <Icon name="close" size={12} />}</button>
            </div>
            <PickSelect
              label="Type"
              value={filter.category ?? ""}
              onChange={(v) => set({ category: (v || null) as LogFilter["category"] })}
              options={[{ value: "", label: "Any type" }, ...["Movie", "TV Show", "Concert", "Live Event"].map((c) => ({ value: c, label: c }))]}
            />
            <PickSelect label="Sort by" value={order} idle="default" onChange={(v) => setOrder(v as Order)} options={ORDERS.map((o) => ({ value: o.id, label: o.label }))} />
            {/* A minimum only offers ratings up to the maximum, and the maximum only ratings from the minimum, so the two can never disagree. */}
            <PickSelect
              label="Minimum rating"
              value={filter.minRating === null ? "" : String(filter.minRating)}
              onChange={(v) => set({ minRating: v ? Number(v) : null })}
              options={[{ value: "", label: "Any rating" }, ...[5, 6, 7, 8, 9].filter((n) => filter.maxRating === null || n <= filter.maxRating || n === filter.minRating).map((n) => ({ value: String(n), label: `★ ${n}+` }))]}
            />
            <PickSelect
              label="Maximum rating"
              value={filter.maxRating === null ? "" : String(filter.maxRating)}
              onChange={(v) => set({ maxRating: v ? Number(v) : null })}
              options={[{ value: "", label: "No rating ceiling" }, ...[4, 5, 6, 7, 8].filter((n) => filter.minRating === null || n >= filter.minRating || n === filter.maxRating).map((n) => ({ value: String(n), label: `★ up to ${n}` }))]}
            />
            <PickSelect
              className="col-span-2"
              label="Released from"
              value={filter.releaseFrom === null ? "" : String(filter.releaseFrom)}
              onChange={(v) => set({ releaseFrom: v ? Number(v) : null })}
              options={[{ value: "", label: "Released from any year" }, ...yearsWith(filter.releaseFrom).filter((y) => filter.releaseTo === null || y <= filter.releaseTo || y === filter.releaseFrom).map((y) => ({ value: String(y), label: String(y), shown: `Released from ${y}` }))]}
            />
            <PickSelect
              className="col-span-2"
              label="Released to"
              value={filter.releaseTo === null ? "" : String(filter.releaseTo)}
              onChange={(v) => set({ releaseTo: v ? Number(v) : null })}
              options={[{ value: "", label: "Released to any year" }, ...yearsWith(filter.releaseTo).filter((y) => filter.releaseFrom === null || y >= filter.releaseFrom || y === filter.releaseTo).map((y) => ({ value: String(y), label: String(y), shown: `Released to ${y}` }))]}
            />
            <div className="relative min-w-0"><input inputMode="numeric" value={plan.minRuntime ?? ""} onChange={(e) => drop({ minRuntime: minutes(e.target.value) })} placeholder="Over (minutes)" aria-label="Longer than, in minutes" className={`${FIELD} w-full pr-11`} />{plan.minRuntime !== null && <ClearX label="Over minutes" onClear={() => drop({ minRuntime: null })} />}</div>
            <div className="relative min-w-0"><input inputMode="numeric" value={plan.maxRuntime ?? ""} onChange={(e) => drop({ maxRuntime: minutes(e.target.value) })} placeholder="Under (minutes)" aria-label="Shorter than, in minutes" className={`${FIELD} w-full pr-11`} />{plan.maxRuntime !== null && <ClearX label="Under minutes" onClear={() => drop({ maxRuntime: null })} />}</div>
            <div className="col-span-2 flex flex-col gap-3">
              <SuggestTags
                label="People"
                tags={peopleTags}
                placeholder="Agnès Varda"
                search={async (text) => {
                  const res = await services.catalog.searchPeople(text);
                  return res.ok ? res.value.map((p) => ({ id: String(p.tmdbId), label: p.name, image: p.profilePath, note: p.knownFor ?? null })) : [];
                }}
                onAdd={(t) => drop({ people: [...plan.people.filter((x) => x.tmdbId !== Number(t.id)), { name: t.label, role: "any", tmdbId: Number(t.id), profilePath: t.image ?? null }] })}
                onRemove={(id) => drop({ people: plan.people.filter((p) => String(p.tmdbId ?? p.name) !== id) })}
              />
              <SuggestTags label="Genres" tags={tagsOf("g:")} options={GENRE_TAGS} showOnTap placeholder="Drama, Comedy" onAdd={(t) => drop({ genres: [...new Set([...plan.genres, t.id])] })} onRemove={(id) => removeTag("g:", id)} />
              <SuggestTags label="Countries" tags={tagsOf("c:")} options={COUNTRY_TAGS} placeholder="France, Germany" onAdd={(t) => drop({ countries: [...new Set([...plan.countries, t.id])] })} onRemove={(id) => removeTag("c:", id)} />
              <SuggestTags label="Languages" tags={tagsOf("lang:")} options={LANGUAGE_TAGS} placeholder="French, Japanese" onAdd={(t) => drop({ languages: [...new Set([...plan.languages, t.id])] })} onRemove={(id) => removeTag("lang:", id)} />
              <SuggestTags
                label="Keywords"
                tags={tagsOf("k:", lower)}
                allowFree
                placeholder="heist, German expressionism"
                search={async (text) => {
                  const res = await services.catalog.searchKeywords(text);
                  return res.ok ? res.value.map((k) => ({ id: k.toLowerCase(), label: k })) : [];
                }}
                onAdd={(t) => drop({ keywords: [...new Set([...plan.keywords, t.label])] })}
                onRemove={(id) => removeTag("k:", id, lower)}
              />
              <SuggestTags label="Streaming on" tags={tagsOf("prov:").map((t) => ({ ...t, label: t.label.replace(/^On /, "") }))} options={PROVIDER_TAGS} allowFree showOnTap placeholder="Netflix, Crave" onAdd={(t) => drop({ providers: [...new Set([...plan.providers, t.label])].slice(0, 3) })} onRemove={(id) => removeTag("prov:", id)} />
            </div>
            <SuggestInput
              className="col-span-2"
              label="Venue"
              placeholder="Cineplex Yonge-Dundas"
              value={filter.venue ?? ""}
              onChange={(v) => set({ venue: v || null })}
              search={async (text) => {
                const res = text.length >= 2 ? await services.browse.searchVenues(text) : await services.browse.recentVenues();
                return res.ok ? [...new Set(res.value.map((v) => v.name))].slice(0, 20) : [];
              }}
            />
            <SuggestInput className="col-span-2" label="Format" placeholder="IMAX" value={filter.format ?? ""} onChange={(v) => set({ format: v || null })} options={PRIMARY_FORMATS} />
            <SuggestInput className="col-span-2" label="Extras" placeholder="3D, D-BOX" value={filter.extra ?? ""} onChange={(v) => set({ extra: v || null })} options={FORMAT_ADDONS} />
            <label className="flex min-w-0 flex-col gap-1"><span className="px-1 text-xs text-neutral-500">Watched from</span><DateField value={filter.dateFrom ?? ""} onChange={(v) => set({ dateFrom: v || null })} label="Watched from" hint="yearAgo" /></label>
            <label className="flex min-w-0 flex-col gap-1"><span className="px-1 text-xs text-neutral-500">Watched to</span><DateField value={filter.dateTo ?? ""} onChange={(v) => set({ dateTo: v || null })} label="Watched to" /></label>
          </div>
        </div>
      )}

      {((outsideOthers && (scope !== null || filterChips.length > 0)) || outsideChips.length > 0 || (current?.plan?.missing.length ?? 0) > 0) && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {/* Searching inside one list; the x goes back to searching everything. */}
          {([["watched", inWatched, "In Watched"], ["watchlist", inWatchlist, "In Watchlist"]] as const).filter(([, on]) => on && outsideOthers).map(([which, , label]) => (
            <li key={which} className="flex items-center gap-1 rounded-full bg-neutral-950 py-1 pl-3 pr-1 text-white dark:bg-white dark:text-neutral-950">
              <span>{label}</span>
              <button type="button" aria-label={`Remove ${label}`} onClick={() => toggleList(which)} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/15"><Icon name="close" size={11} /></button>
            </li>
          ))}
          {(outsideOthers ? filterChips : []).map((c) => (
            <li key={c.key} className="flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 dark:bg-neutral-800">
              <span>{c.label}</span>
              <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove} className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 dark:bg-white/15"><Icon name="close" size={11} /></button>
            </li>
          ))}
          {/* Each part of the plan can be taken out; the list then updates without asking the AI again. */}
          {outsideChips.map((c) => (
            <li key={c.key} className={`flex items-center gap-1 rounded-full bg-neutral-950 py-1 pr-1 text-white dark:bg-white dark:text-neutral-950 ${c.image !== undefined ? "pl-1" : "pl-3"}`}>
              {c.image !== undefined && (tmdbImageUrl(c.image, "w185")
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={tmdbImageUrl(c.image, "w185") ?? ""} alt="" className="h-5 w-5 rounded-full object-cover" />
                : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-500"><Icon name="user" size={11} /></span>)}
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
