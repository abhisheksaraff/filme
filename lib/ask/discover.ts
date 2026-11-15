// lib/ask/discover.ts
// Turns what the AI understood from a question into real TMDB results: people and mood words are looked up first,
// then the lists are fetched. When nothing fits, the plan is loosened step by step and the person is told how.
import type { LogFilter } from "@/lib/domain/askLog";
import type { AskPlan } from "@/lib/domain/askPlan";
import type { BrowseSpec, Catalog, CatalogHit, CatalogKind } from "@/lib/ports/catalog";

const PAGES = 3;
/** "Best" lists need enough votes, or an obscure title with two perfect scores wins. */
const MIN_VOTES = 200;

export interface DiscoverInput {
  plan: AskPlan;
  filter: LogFilter;
  kinds: CatalogKind[];
  catalog: Catalog;
  /** Finds a person by name, your own log first, the more famous match winning. */
  lookupPerson: (name: string) => Promise<{ tmdbId: number; name: string } | null>;
  genreId: (name: string) => number | undefined;
  isSeen: (hit: CatalogHit) => boolean;
}

export interface DiscoverOutcome {
  hits: CatalogHit[];
  people: { name: string; tmdbId: number; role: AskPlan["people"][number]["role"] }[];
  /** Names, themes or titles that could not be found. */
  missing: string[];
  /** Set when the plan had to be loosened to find anything. */
  notice: string | null;
}

const key = (h: CatalogHit) => `${h.kind}:${h.tmdbId}`;

function dedupe(hits: CatalogHit[]): CatalogHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(key(h)) ? false : (seen.add(key(h)), true)));
}

export async function discover(input: DiscoverInput): Promise<DiscoverOutcome> {
  const { plan, filter, kinds, catalog } = input;
  const missing: string[] = [];

  // Everything that needs looking up goes out together.
  const [people, keywordIds, named] = await Promise.all([
    Promise.all(plan.people.map(async (p) => ({ p, hit: await input.lookupPerson(p.name) }))),
    Promise.all(plan.keywords.map(async (k) => {
      const res = await catalog.findKeyword(k);
      return { k, id: res.ok ? res.value : null };
    })),
    Promise.all(plan.titles.flatMap((title) => kinds.map(async (kind) => {
      const res = await catalog.search(title, kind);
      return { title, hit: res.ok ? (res.value[0] ?? null) : null };
    }))),
  ]);

  const found = people.flatMap(({ p, hit }) => (hit ? [{ name: hit.name, tmdbId: hit.tmdbId, role: p.role }] : (missing.push(p.name), [])));
  const keywords = keywordIds.flatMap(({ k, id }) => (id !== null ? [id] : (missing.push(k), [])));
  const genreIds = plan.genres.flatMap((g) => {
    const id = input.genreId(g);
    return id !== undefined ? [id] : (missing.push(g), []);
  });
  // A title is missing only when no kind found it.
  const namedHits = dedupe(named.flatMap((n) => (n.hit ? [n.hit] : [])));
  for (const title of plan.titles) if (!named.some((n) => n.title === title && n.hit)) missing.push(title);

  const sortBy: BrowseSpec["sortBy"] =
    plan.sortBy === "rating" ? "vote_average.desc" : plan.sortBy === "newest" ? "primary_release_date.desc" : plan.sortBy === "oldest" ? "primary_release_date.asc" : "popularity.desc";
  const rated = plan.sortBy === "rating" || filter.minRating !== null;
  const languages: (string | undefined)[] = plan.languages.length > 0 ? plan.languages : [undefined];

  async function run(opts: { keywords: boolean; genres: boolean; everyone: boolean }): Promise<CatalogHit[]> {
    const lists = await Promise.all(kinds.map(async (kind): Promise<CatalogHit[]> => {
      const actors = found.filter((f) => f.role === "cast" || f.role === "any").map((f) => f.tmdbId);
      const crew = found.filter((f) => f.role === "director" || f.role === "writer").map((f) => f.tmdbId);
      const gids = opts.genres ? genreIds : [];

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
        return tv.filter((h) => {
          const year = Number(h.year);
          if (gids.length > 0 && h.genreIds && !gids.some((g) => h.genreIds?.includes(g))) return false;
          if (plan.languages.length > 0 && h.language && !plan.languages.includes(h.language)) return false;
          if (filter.releaseFrom !== null && (!year || year < filter.releaseFrom)) return false;
          if (filter.releaseTo !== null && (!year || year > filter.releaseTo)) return false;
          if (filter.minRating !== null && (h.voteAverage ?? 0) < filter.minRating) return false;
          return true;
        });
      }

      const specs: BrowseSpec[] = languages.flatMap((language) =>
        Array.from({ length: PAGES }, (_, i): BrowseSpec => ({
          kind,
          sortBy,
          page: i + 1,
          language,
          country: plan.countries[0],
          genreId: gids[0],
          yearFrom: filter.releaseFrom ?? undefined,
          yearTo: filter.releaseTo ?? undefined,
          minRating: filter.minRating ?? undefined,
          minVotes: rated ? MIN_VOTES : undefined,
          keywordIds: opts.keywords && keywords.length > 0 ? keywords : undefined,
          castAll: kind === "Movie" && !opts.everyone && actors.length > 0 ? actors : undefined,
          castAny: kind === "Movie" && opts.everyone && actors.length > 0 ? actors : undefined,
          crewAny: kind === "Movie" && crew.length > 0 ? crew : undefined,
        })));
      const pages = await Promise.all(specs.map((s) => catalog.browse(s)));
      const merged = dedupe(pages.flatMap((r) => (r.ok ? r.value : [])));
      // A second or third genre is checked here, since the list can only be asked for one.
      return gids.length > 1 ? merged.filter((h) => gids.every((g) => h.genreIds?.includes(g) ?? true)) : merged;
    }));
    return dedupe(lists.flat());
  }

  let notice: string | null = null;
  let hits = await run({ keywords: true, genres: true, everyone: false });
  // Loosen one thing at a time: mood words first, then genre, then "all of them" to "any of them".
  if (hits.length === 0 && keywords.length > 0) {
    hits = await run({ keywords: false, genres: true, everyone: false });
    if (hits.length > 0) notice = "Nothing matched the mood words, so they were left out.";
  }
  if (hits.length === 0 && genreIds.length > 0) {
    hits = await run({ keywords: false, genres: false, everyone: false });
    if (hits.length > 0) notice = "Nothing matched that genre, so it was left out.";
  }
  if (hits.length === 0 && found.length > 1) {
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
    return res.ok ? res.value.filter((h) => kinds.includes(h.kind)) : [];
  }));

  let all = dedupe([...namedHits, ...likeLists.flat(), ...hits]);
  if (plan.seen === "not-seen") all = all.filter((h) => !input.isSeen(h));
  if (plan.seen === "seen") all = all.filter((h) => input.isSeen(h));
  // Newest and oldest lists keep their order from TMDB for movies; credit lists are sorted here.
  if (plan.sortBy === "newest") all.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  else if (plan.sortBy === "oldest") all.sort((a, b) => (a.releaseDate ?? "9").localeCompare(b.releaseDate ?? "9"));
  else if (plan.sortBy === "rating") all.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0));

  return { hits: all, people: found, missing: [...new Set(missing)], notice };
}
