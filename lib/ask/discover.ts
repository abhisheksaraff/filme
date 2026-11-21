// lib/ask/discover.ts
// Turns what the AI understood from a question into real TMDB results: people and mood words are looked up first,
// then the lists are fetched. When nothing fits, the plan is loosened step by step and the person is told how.
import type { LogFilter } from "@/lib/domain/askLog";
import type { AskPlan } from "@/lib/domain/askPlan";
import type { BrowseSpec, Catalog, CatalogHit, CatalogKind } from "@/lib/ports/catalog";

const PAGES = 3;
/** The most TMDB lists asked for at once for one kind of title, however many countries, languages and genres were typed. */
const MAX_LISTS = 15;
/** "Best" lists need enough votes, or an obscure title with two perfect scores wins. */
const MIN_VOTES = 200;

export interface DiscoverInput {
  plan: AskPlan;
  filter: LogFilter;
  kinds: CatalogKind[];
  catalog: Catalog;
  /** Finds a person by name, your own log first, the more famous match winning. People picked by hand skip this. */
  lookupPerson: (name: string) => Promise<{ tmdbId: number; name: string; profilePath?: string | null } | null>;
  genreId: (name: string) => number | undefined;
  isSeen: (hit: CatalogHit) => boolean;
}

export interface DiscoverOutcome {
  hits: CatalogHit[];
  people: { name: string; tmdbId: number; role: AskPlan["people"][number]["role"]; profilePath: string | null }[];
  /**
   * Where each title sits when several countries, languages or genres were asked for: 0 for titles that match the most of
   * them, then those that match the first one typed, then the next. Absent when only one of each was asked for.
   */
  groups: Record<string, number>;
  /** Names, themes or titles that could not be found. */
  missing: string[];
  /** Set when the plan had to be loosened to find anything. */
  notice: string | null;
}

/** TMDB's ids for the streaming services offered in Canada, by the names people use. */
const PROVIDERS: [RegExp, number][] = [
  [/netflix/i, 8], [/prime|amazon/i, 9], [/disney/i, 337], [/crave/i, 230], [/apple/i, 350],
  [/paramount/i, 531], [/\bmax\b|hbo/i, 1899], [/crunchyroll/i, 283],
];
const REGION = "CA";

const key = (h: CatalogHit) => `${h.kind}:${h.tmdbId}`;

/** A title with the typed countries, languages and genres (by position in what was typed) that it was found under. */
interface Tagged {
  hit: CatalogHit;
  countries: Set<number>;
  languages: Set<number>;
  genres: Set<number>;
}

const first = (set: Set<number>) => (set.size === 0 ? 99 : Math.min(...set));

function dedupe(hits: CatalogHit[]): CatalogHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(key(h)) ? false : (seen.add(key(h)), true)));
}

export async function discover(input: DiscoverInput): Promise<DiscoverOutcome> {
  const { plan, filter, kinds, catalog } = input;
  const missing: string[] = [];

  // A genre the film database does not have (noir, giallo, slasher) is looked up as a theme word instead.
  const genreNames = plan.genres.map((g) => ({ g, id: input.genreId(g) }));
  const themeWords = [...plan.keywords, ...genreNames.filter((x) => x.id === undefined).map((x) => x.g)];

  // Everything that needs looking up goes out together.
  const [people, keywordIds, named] = await Promise.all([
    // A person picked from the suggestions already has their id, so they are never searched for again.
    Promise.all(plan.people.map(async (p) => ({ p, hit: p.tmdbId ? { tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath ?? null } : await input.lookupPerson(p.name) }))),
    Promise.all(themeWords.map(async (k) => {
      const res = await catalog.findKeyword(k);
      return { k, id: res.ok ? res.value : null };
    })),
    Promise.all(plan.titles.flatMap((title) => kinds.map(async (kind) => {
      const res = await catalog.search(title, kind);
      return { title, hit: res.ok ? (res.value[0] ?? null) : null };
    }))),
  ]);

  const providerIds = plan.providers.flatMap((name) => {
    const hit = PROVIDERS.find(([pattern]) => pattern.test(name));
    return hit ? [hit[1]] : (missing.push(name), []);
  });
  const found = people.flatMap(({ p, hit }) => (hit ? [{ name: hit.name, tmdbId: hit.tmdbId, role: p.role, profilePath: hit.profilePath ?? null }] : (missing.push(p.name), [])));
  const keywords = [...new Set(keywordIds.flatMap(({ k, id }) => (id !== null ? [id] : (missing.push(k), []))))];
  const genreIds = genreNames.flatMap((x) => (x.id !== undefined ? [x.id] : []));
  // A title is missing only when no kind found it.
  const namedHits = dedupe(named.flatMap((n) => (n.hit ? [n.hit] : [])));
  for (const title of plan.titles) if (!named.some((n) => n.title === title && n.hit)) missing.push(title);

  const sortBy: BrowseSpec["sortBy"] =
    plan.sortBy === "rating" ? "vote_average.desc" : plan.sortBy === "newest" ? "primary_release_date.desc" : plan.sortBy === "oldest" ? "primary_release_date.asc" : "popularity.desc";
  const rated = plan.sortBy === "rating" || filter.minRating !== null;
  const languages: (string | undefined)[] = plan.languages.length > 0 ? plan.languages : [undefined];
  const countries: (string | undefined)[] = plan.countries.length > 0 ? plan.countries : [undefined];

  async function run(opts: { keywords: boolean; genres: boolean; everyone: boolean }): Promise<Tagged[]> {
    const lists = await Promise.all(kinds.map(async (kind): Promise<Tagged[]> => {
      const actors = found.filter((f) => f.role === "cast" || f.role === "any").map((f) => f.tmdbId);
      const crew = found.filter((f) => f.role === "director" || f.role === "writer").map((f) => f.tmdbId);
      const gids = opts.genres ? genreIds : [];
      const plain = (hit: CatalogHit): Tagged => ({ hit, countries: new Set(), languages: new Set(), genres: new Set() });

      // TMDB cannot filter shows by person, so a show's list comes from each person's credits.
      if (kind === "TV Show" && found.length > 0) {
        const credits = await Promise.all(found.map(async (f) => {
          const res = await catalog.personCredits(f.tmdbId);
          return res.ok ? res.value.filter((h) => h.kind === "TV Show") : [];
        }));
        let tv = credits[0] ?? [];
        for (const more of credits.slice(1)) {
          const ids = new Set(more.map((h) => h.tmdbId));
          tv = opts.everyone ? dedupe([...tv, ...more]) : tv.filter((h) => ids.has(h.tmdbId));
        }
        return tv.map(plain).filter(({ hit: h }) => {
          const year = Number(h.year);
          if (gids.length > 0 && h.genreIds && !gids.some((g) => h.genreIds?.includes(g))) return false;
          if (plan.languages.length > 0 && h.language && !plan.languages.includes(h.language)) return false;
          if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
          if (filter.releaseTo !== null && (!year || year > filter.releaseTo)) return false;
          if (filter.minRating !== null && (h.voteAverage ?? 0) < filter.minRating) return false;
          return true;
        });
      }

      // One list for each country, language and genre typed, so a title found under more than one of them is known.
      const genreChoices: (number | undefined)[] = gids.length > 0 ? gids : [undefined];
      const combos = countries.flatMap((country, ci) => languages.flatMap((language, li) => genreChoices.map((genre, gi) => ({ country, language, genre, ci, li, gi })))).slice(0, MAX_LISTS);
      const pages = Math.max(1, Math.min(PAGES, Math.floor(MAX_LISTS / combos.length)));
      const specs = combos.flatMap((combo) =>
        Array.from({ length: pages }, (_, i): { spec: BrowseSpec; combo: (typeof combos)[number] } => ({
          combo,
          spec: {
          kind,
          sortBy,
          page: i + 1,
          language: combo.language,
          country: combo.country,
          genreId: combo.genre,
          yearFrom: filter.releaseFrom ?? undefined,
          yearTo: filter.releaseTo ?? undefined,
          minRating: filter.minRating ?? undefined,
          minVotes: rated ? MIN_VOTES : undefined,
          keywordIds: opts.keywords && keywords.length > 0 ? keywords : undefined,
          castAll: kind === "Movie" && !opts.everyone && actors.length > 0 ? actors : undefined,
          castAny: kind === "Movie" && opts.everyone && actors.length > 0 ? actors : undefined,
          crewAny: kind === "Movie" && crew.length > 0 ? crew : undefined,
          maxRuntime: plan.maxRuntime ?? undefined,
          minRuntime: plan.minRuntime ?? undefined,
          providerIds: providerIds.length > 0 ? providerIds : undefined,
          region: REGION,
          },
        })));
      const results = await Promise.all(specs.map(async (s) => ({ combo: s.combo, res: await catalog.browse(s.spec) })));
      const byKey = new Map<string, Tagged>();
      for (const { combo, res } of results) {
        for (const hit of res.ok ? res.value : []) {
          const tagged = byKey.get(key(hit)) ?? plain(hit);
          tagged.countries.add(combo.ci);
          tagged.languages.add(combo.li);
          if (combo.genre !== undefined) tagged.genres.add(combo.gi);
          byKey.set(key(hit), tagged);
        }
      }
      return [...byKey.values()];
    }));
    const byKey = new Map<string, Tagged>();
    for (const t of lists.flat()) if (!byKey.has(key(t.hit))) byKey.set(key(t.hit), t);
    return [...byKey.values()];
  }

  // "In cinemas now" or "coming soon" is its own list, narrowed here by whatever else was asked.
  const cinema = plan.inTheatres && kinds.includes("Movie")
    ? await Promise.all((plan.inTheatres === "both" ? (["now", "soon"] as const) : [plan.inTheatres]).map((when) => catalog.theatres(when, REGION))).then((lists) => dedupe(lists.flatMap((r) => (r.ok ? r.value : []))).filter((h) => {
        const year = Number(h.year);
        if (genreIds.length > 0 && h.genreIds && !genreIds.every((g) => h.genreIds?.includes(g))) return false;
        if (plan.languages.length > 0 && h.language && !plan.languages.includes(h.language)) return false;
        if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
        if (filter.minRating !== null && (h.voteAverage ?? 0) < filter.minRating) return false;
        return true;
      }))
    : null;

  let notice: string | null = null;
  const asTagged = (list: CatalogHit[]): Tagged[] => list.map((hit) => ({ hit, countries: new Set(), languages: new Set(), genres: new Set() }));
  let hits = cinema ? asTagged(cinema) : await run({ keywords: true, genres: true, everyone: false });
  // Loosen one thing at a time: mood words first, then genre, then "all of them" to "any of them".
  if (!cinema && hits.length === 0 && keywords.length > 0) {
    hits = await run({ keywords: false, genres: true, everyone: false });
    if (hits.length > 0) notice = "Nothing matched the mood words, so they were left out.";
  }
  if (!cinema && hits.length === 0 && genreIds.length > 0) {
    hits = await run({ keywords: false, genres: false, everyone: false });
    if (hits.length > 0) notice = "Nothing matched that genre, so it was left out.";
  }
  if (!cinema && hits.length === 0 && found.length > 1) {
    hits = await run({ keywords: false, genres: false, everyone: true });
    if (hits.length > 0) notice = "No title has all of them, so these have any one of them.";
  }

  // "More like" titles come from TMDB's recommendations.
  const likeLists = await Promise.all(plan.like.map(async (title) => {
    const match = await catalog.findClosest(title, null);
    if (!match.ok || !match.value) {
      missing.push(title);
      return [];
    }
    const res = await catalog.recommendations(match.value);
    // "Like X but newer" keeps the release years the question set.
    return res.ok ? res.value.filter((h) => {
      const year = Number(h.year);
      if (!kinds.includes(h.kind)) return false;
      if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
      if (filter.releaseTo !== null && (!year || year > filter.releaseTo)) return false;
      return true;
    }) : [];
  }));

  // With several countries, languages or genres: titles that match the most come first, then those that match the first one
  // typed, then the next; the sort asked for applies inside each of these groups.
  const score = (t: Tagged) => (plan.countries.length > 1 ? t.countries.size : 0) + (plan.languages.length > 1 ? t.languages.size : 0) + (genreIds.length > 1 ? t.genres.size : 0);
  const rankKey = (t: Tagged) => `${String(9 - score(t))}|${first(t.countries)}|${first(t.languages)}|${first(t.genres)}`;
  const keys = [...new Set(hits.map(rankKey))].sort();
  const grouped = keys.length > 1 && (plan.countries.length > 1 || plan.languages.length > 1 || genreIds.length > 1);
  const groupOf = (t: Tagged) => (grouped ? keys.indexOf(rankKey(t)) : 0);

  // A single person with no sort asked for lists newest first, so their latest work is on top.
  const order = plan.sortBy ?? (found.length > 0 ? "newest" : null);
  const within = (a: CatalogHit, b: CatalogHit) =>
    order === "newest" ? (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
    : order === "oldest" ? (a.releaseDate ?? "9").localeCompare(b.releaseDate ?? "9")
    : order === "rating" ? (b.voteAverage ?? 0) - (a.voteAverage ?? 0)
    : 0;
  const ranked = [...hits].sort((a, b) => groupOf(a) - groupOf(b) || within(a.hit, b.hit));
  const groups: Record<string, number> = {};
  if (grouped) for (const t of ranked) groups[key(t.hit)] = groupOf(t);

  let all = dedupe([...namedHits, ...likeLists.flat(), ...ranked.map((t) => t.hit)]);
  if (plan.seen === "not-seen") all = all.filter((h) => !input.isSeen(h));
  if (plan.seen === "seen") all = all.filter((h) => input.isSeen(h));
  return { hits: all, people: found, missing: [...new Set(missing)], notice, groups };
}
