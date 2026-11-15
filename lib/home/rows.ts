// lib/home/rows.ts
// Builds each Home row from the log, the watchlist and TMDB. Rows are kept until the app
// is reopened or the user refreshes, so coming back to Home never reshuffles or spends TMDB calls.
import { ART_HOUSE, GENRES, TV_GENRES, WORLD_CINEMA } from "@/lib/domain/home";
import { THEMES } from "@/lib/domain/holidays";
import type { StatRow } from "@/lib/domain/stats";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CatalogHit, CatalogKind, CatalogMatch } from "@/lib/ports/catalog";
import type { WantedItem } from "@/lib/ports/wanted";
import { fail, ok, type Result } from "@/lib/ports/result";
import { clearStored, readStored, writeStored } from "@/lib/persistentCache";
import { services } from "@/lib/services";
import { checkNewEpisodes, inProgress, withNewEpisodes } from "@/lib/shows";
import { withShow } from "@/lib/domain/tv";
import type { TrackedShow } from "@/lib/ports/follows";

export interface RowItem {
  key: string;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  href: string;
  /** A random pick mixed into a genre row. */
  surprise?: boolean;
}

export interface RowResult {
  title: string;
  /** A theme slug whose drawn icon sits beside the title, such as on a holiday row. */
  icon?: string;
  items: RowItem[];
  /** A line under the row title, such as the country on World Cinema. */
  subtitle?: string;
  /** Shown when the row has nothing in it. */
  empty: string;
}

const CACHE_MS = 3 * 60 * 60_000;
/** How long a Home row stays on the phone before it is rebuilt. */
const ROW_KEEP_MS = 6 * 60 * 60_000;
/** About one slot in four of a genre row is swapped for a random pick. */
const SURPRISE_RATE = 0.25;
const ROW_SIZE = 16;
const DRAMA = 18;


const cache = new Map<string, { at: number; value: Promise<Result<unknown>> }>();
const usedSurprises = new Set<string>();
/** The last finished answer for each row, readable at once, so Home can come back exactly as it was left. */
const resolved = new Map<string, Result<RowResult>>();

/** A row's last finished answer, if it has one this visit. */
export function peekRow(id: string): Result<RowResult> | null {
  return resolved.get(id) ?? null;
}

/** Runs `make` once per key within `ttl` milliseconds; failures are not kept. */
function cached<T>(key: string, make: () => Promise<Result<T>>, ttl = CACHE_MS, persist = false): Promise<Result<T>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<Result<T>>;
  // Rows kept on the phone show at once when the app reopens, and are only rebuilt after a few hours or on Refresh.
  if (persist) {
    const stored = readStored<T>(key, ROW_KEEP_MS);
    if (stored !== undefined) {
      const value = Promise.resolve(ok(stored));
      cache.set(key, { at: Date.now(), value });
      return value;
    }
  }
  const value = make();
  cache.set(key, { at: Date.now(), value });
  value.then((res) => {
    if (!res.ok && cache.get(key)?.value === value) cache.delete(key);
    else if (res.ok && persist) writeStored(key, res.value);
  });
  return value;
}

/** Forgets every row so the next load picks fresh titles. */
export function clearHomeCache(): void {
  cache.clear();
  resolved.clear();
  clearStored("row:");
  usedSurprises.clear();
}

export function seenKey(kind: CatalogKind, tmdbId: number): string {
  return `${kind}:${tmdbId}`;
}

export function previewHref(kind: CatalogKind, tmdbId: number): string {
  return `/preview/?kind=${kind === "Movie" ? "movie" : "tv"}&id=${tmdbId}`;
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const randomPage = (max: number) => 1 + Math.floor(Math.random() * max);

/** Alternates two lists so neither crowds the other out. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function hitItem(hit: CatalogHit): RowItem {
  return {
    key: seenKey(hit.kind, hit.tmdbId),
    title: hit.title,
    subtitle: hit.year,
    posterUrl: hit.posterUrl,
    href: previewHref(hit.kind, hit.tmdbId),
  };
}

/** Titles marked "Not interested", as "Movie:123" keys. */
async function hiddenKeys(): Promise<string[]> {
  const res = await cached("hidden", () => services.hidden.list());
  return res.ok ? res.value.map((h) => seenKey(h.category, h.tmdbId)) : [];
}

/** Titles already seen or marked not interested; if either cannot be read, nothing is left out for it. */
async function seenSet(): Promise<Set<string>> {
  const [res, hidden] = await Promise.all([cached("seen", () => services.log.seen()), hiddenKeys()]);
  return new Set([...(res.ok ? res.value : []), ...hidden]);
}

/** One shared batch of random picks that every genre row draws its surprises from. */
async function surprisePool(): Promise<RowItem[]> {
  const res = await cached("pool", async () => {
    const hits = await services.catalog.browse({
      kind: "Movie",
      genreId: pick(GENRES).id,
      sortBy: "vote_average.desc",
      minVotes: 500,
      minRating: 6.5,
      page: randomPage(5),
    });
    return hits.ok ? ok(shuffle(hits.value.map(hitItem))) : hits;
  });
  return res.ok ? res.value : [];
}

/** Swaps about one slot in four for a random pick, never repeating a title across rows. */
function injectSurprises(items: RowItem[], pool: RowItem[]): RowItem[] {
  const present = new Set(items.map((item) => item.key));
  return items.map((item) => {
    if (Math.random() >= SURPRISE_RATE) return item;
    const next = pool.find((c) => !usedSurprises.has(c.key) && !present.has(c.key));
    if (!next) return item;
    usedSurprises.add(next.key);
    present.add(next.key);
    return { ...next, surprise: true };
  });
}

/** How many of the user's own titles each "You might also like" row starts from. */
const SEEDS = 3;

/**
 * Picks a few titles at random from everything the user has logged, old or new, and mixes what TMDB
 * recommends for each into one shuffled row, leaving out anything already seen or saved.
 */
async function likeRow(kind: CatalogKind): Promise<Result<RowResult>> {
  const title = kind === "Movie" ? "You might also like" : "TV shows you might like";
  const [seenRes, wanted] = await Promise.all([services.log.seen(), services.wanted.list()]);
  if (!seenRes.ok) return seenRes;
  const mine = seenRes.value.filter((key) => key.startsWith(`${kind}:`)).map((key) => ({ kind, tmdbId: Number(key.slice(kind.length + 1)) }));
  const seeds = shuffle(mine.filter((m) => Number.isFinite(m.tmdbId))).slice(0, SEEDS);
  if (seeds.length === 0) {
    // Nothing of this kind logged yet: well-regarded titles stand in until there is something to base picks on.
    const popular = await services.catalog.browse({ kind, sortBy: "vote_average.desc", minVotes: 500, minRating: 7.5, page: randomPage(3) });
    if (!popular.ok) return popular;
    const skipAll = new Set([...seenRes.value, ...(await hiddenKeys())]);
    return ok({ title, items: shuffle(popular.value).filter((h) => !skipAll.has(seenKey(h.kind, h.tmdbId))).slice(0, 18).map(hitItem), empty: "No picks right now." });
  }

  const lists = await Promise.all(seeds.map((match) => services.catalog.recommendations(match)));
  const good = lists.flatMap((list) => (list.ok ? [list.value] : []));
  if (good.length === 0) {
    const bad = lists.find((list) => !list.ok);
    return bad && !bad.ok ? fail(bad.error) : ok({ title, items: [], empty: "No picks right now." });
  }

  const skip = new Set([...seenRes.value, ...(await hiddenKeys())]);
  for (const w of wanted.ok ? wanted.value : []) if (w.tmdbId !== null) skip.add(seenKey(w.category === "TV Show" ? "TV Show" : "Movie", w.tmdbId));
  const unique = new Map<string, CatalogHit>();
  for (const hit of shuffle(good.flat())) if (!skip.has(seenKey(hit.kind, hit.tmdbId))) unique.set(seenKey(hit.kind, hit.tmdbId), hit);
  return ok({ title, items: [...unique.values()].slice(0, 18).map(hitItem), empty: "No picks right now." });
}

async function wantRow(): Promise<Result<RowResult>> {
  const res = await services.wanted.list();
  if (!res.ok) return res;
  const items = res.value.map((item): RowItem => {
    const kind: CatalogKind = item.category === "TV Show" ? "TV Show" : "Movie";
    return {
      key: `want:${item.mediaId}`,
      title: withShow(item.title, item.season, item.episode),
      subtitle: null,
      posterUrl: tmdbImageUrl(item.posterPath, "w185"),
      href:
        item.episode !== null
          ? `/episode/?id=${item.mediaId}&s=${item.season ?? 1}&e=${item.episode}`
          : item.season !== null
            ? `/season/?id=${item.mediaId}&n=${item.season}`
            : item.tmdbId === null
              ? `/title/?id=${item.mediaId}`
              : previewHref(kind, item.tmdbId),
    };
  });
  return ok({ title: "Watchlist", items, empty: "Nothing saved yet. Search for a title and tap the bookmark." });
}

/** Shows the user has watched or follows, with the latest aired episode from the daily check. */
async function trackedShows(): Promise<Result<TrackedShow[]>> {
  // The check runs once a day; waiting for it here means the first Home of the day is not a day behind.
  await checkNewEpisodes();
  return services.follows.tracked();
}

function showItem(show: TrackedShow, note: string): RowItem {
  return { key: `show:${show.mediaId}`, title: show.title, subtitle: note, posterUrl: tmdbImageUrl(show.posterPath, "w342"), href: `/title/?id=${show.mediaId}` };
}

async function newEpisodesRow(): Promise<Result<RowResult>> {
  const res = await trackedShows();
  if (!res.ok) return res;
  const items = withNewEpisodes(res.value).map((s) => showItem(s, `S${s.aired?.season} E${s.aired?.episode} · New`));
  return ok({ title: "New episodes", items, empty: "Nothing new from the shows you follow." });
}

async function continueRow(): Promise<Result<RowResult>> {
  const res = await trackedShows();
  if (!res.ok) return res;
  const items = inProgress(res.value).map((s) => showItem(s, `Up to S${s.aired?.season} E${s.aired?.episode}`));
  return ok({ title: "Continue watching", items, empty: "You are caught up on everything you started." });
}

async function favouritesRow(): Promise<Result<RowResult>> {
  const title = "New from your favourites";
  const favourites = await services.log.favourites(3);
  if (!favourites.ok) return favourites;
  if (favourites.value.length === 0) return ok({ title, items: [], empty: "Log and rate a few titles to get picks here." });

  const [seen, lists] = await Promise.all([
    seenSet(),
    Promise.all(favourites.value.map((match) => services.catalog.recommendations(match))),
  ]);
  const good = lists.flatMap((list) => (list.ok ? [list.value] : []));
  if (good.length === 0) {
    const bad = lists.find((list) => !list.ok);
    return bad && !bad.ok ? fail(bad.error) : ok({ title, items: [], empty: "No new picks right now." });
  }

  const unique = new Map<string, CatalogHit>();
  for (const list of good) {
    for (const hit of list) unique.set(seenKey(hit.kind, hit.tmdbId), hit);
  }
  const hits = [...unique.values()]
    .filter((hit) => !seen.has(seenKey(hit.kind, hit.tmdbId)))
    .sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""));
  return ok({ title, items: hits.slice(0, 18).map(hitItem), empty: "No new picks right now." });
}

async function discoverRow(title: string, empty: string, spec: Parameters<typeof services.catalog.browse>[0]): Promise<Result<RowResult>> {
  const [hits, seen] = await Promise.all([services.catalog.browse(spec), seenSet()]);
  if (!hits.ok) return hits;
  const items = hits.value.map(hitItem).filter((item) => !seen.has(item.key)).slice(0, ROW_SIZE);
  return ok({ title, items, empty });
}

async function genreRow(genreId: number): Promise<Result<RowResult>> {
  const genre = GENRES.find((g) => g.id === genreId);
  if (!genre) return fail("Unknown genre.");
  const row = await discoverRow(genre.name, "Nothing new here right now.", {
    kind: "Movie",
    genreId,
    sortBy: "popularity.desc",
    minVotes: 300,
    minRating: 6,
    page: randomPage(3),
  });
  if (!row.ok) return row;
  const pool = await surprisePool();
  return ok({ ...row.value, items: injectSurprises(row.value.items, pool) });
}

async function artHouseRow(): Promise<Result<RowResult>> {
  const { language, country } = pick(ART_HOUSE);
  const row = await discoverRow("Art House", "Nothing found. Try shuffling.", {
    kind: "Movie",
    genreId: DRAMA,
    language,
    sortBy: "vote_average.desc",
    minVotes: 400,
    minRating: 7.3,
    page: randomPage(3),
  });
  return row.ok ? ok({ ...row.value, subtitle: country }) : row;
}

async function wildcardRow(): Promise<Result<RowResult>> {
  const { language, country } = pick(WORLD_CINEMA);
  const row = await discoverRow("World Cinema", "Nothing found. Try shuffling.", {
    kind: "Movie",
    language,
    sortBy: "popularity.desc",
    minVotes: 150,
    minRating: 6.8,
    page: randomPage(4),
  });
  return row.ok ? ok({ ...row.value, subtitle: country }) : row;
}

/** Every viewing in compact form, shared by Home's story chips, the stories and the stats page. */
export function loadStatRows(): Promise<Result<StatRow[]>> {
  return cached("stats", () => services.log.statRows());
}

/** Titles whose name carries the holiday's word, shown while its theme is on. */
async function holidayRow(slug: string): Promise<Result<RowResult>> {
  const holiday = THEMES.find((h) => h.slug === slug);
  if (!holiday) return fail("Unknown holiday.");
  const [movies, shows, seen] = await Promise.all([
    services.catalog.search(holiday.search, "Movie"),
    services.catalog.search(holiday.search, "TV Show"),
    seenSet(),
  ]);
  if (!movies.ok && !shows.ok) return fail(movies.ok ? "Could not search TMDB." : movies.error);
  const hits = interleave(movies.ok ? movies.value : [], shows.ok ? shows.value : []);
  const items = hits.map(hitItem).filter((item) => !seen.has(item.key));
  return ok({ title: `${holiday.name} picks`, icon: holiday.slug, items, empty: "Nothing new for this holiday." });
}

/** Whole titles saved on the watchlist (not single episodes), with the id TMDB knows them by. */
async function savedTitles(): Promise<{ kind: CatalogKind; tmdbId: number; item: WantedItem }[]> {
  const res = await services.wanted.list();
  if (!res.ok) return [];
  return res.value.flatMap((item) =>
    item.tmdbId !== null && item.season === null && item.episode === null && (item.category === "Movie" || item.category === "TV Show")
      ? [{ kind: item.category as CatalogKind, tmdbId: item.tmdbId, item }]
      : [],
  );
}

function savedItem(entry: { kind: CatalogKind; tmdbId: number; item: WantedItem }): RowItem {
  return {
    key: `want:${entry.item.mediaId}`,
    title: entry.item.title,
    subtitle: null,
    posterUrl: tmdbImageUrl(entry.item.posterPath, "w185"),
    href: previewHref(entry.kind, entry.tmdbId),
  };
}

/** A random handful of what is on the watchlist, movies and shows together, reshuffled on every refresh. */
async function wantPickRow(): Promise<Result<RowResult>> {
  const saved = await savedTitles();
  const movies = shuffle(saved.filter((s) => s.kind === "Movie"));
  const shows = shuffle(saved.filter((s) => s.kind === "TV Show"));
  const items = interleave(movies, shows).slice(0, 12).map(savedItem);
  return ok({ title: "From your watchlist", items, empty: "Save a few titles to see picks from your list here." });
}

/** Titles related to the given seeds, leaving out anything already seen, hidden or saved. */
async function relatedTo(seeds: CatalogMatch[], title: string, empty: string): Promise<Result<RowResult>> {
  if (seeds.length === 0) return ok({ title, items: [], empty });
  const [lists, seen, saved] = await Promise.all([
    Promise.all(seeds.map((match) => services.catalog.recommendations(match))),
    seenSet(),
    savedTitles(),
  ]);
  const good = lists.flatMap((list) => (list.ok ? [list.value] : []));
  if (good.length === 0) {
    const bad = lists.find((list) => !list.ok);
    return bad && !bad.ok ? fail(bad.error) : ok({ title, items: [], empty });
  }
  const skip = new Set([...seen, ...saved.map((s) => seenKey(s.kind, s.tmdbId))]);
  const unique = new Map<string, CatalogHit>();
  for (const hit of shuffle(good.flat())) if (!skip.has(seenKey(hit.kind, hit.tmdbId))) unique.set(seenKey(hit.kind, hit.tmdbId), hit);
  return ok({ title, items: [...unique.values()].slice(0, 18).map(hitItem), empty });
}

/** One title picked at random from the watchlist, and what TMDB says goes with it. */
async function becauseSavedRow(): Promise<Result<RowResult>> {
  const saved = await savedTitles();
  const one = saved.length > 0 ? pick(saved) : null;
  if (!one) return ok({ title: "Because you saved a title", items: [], empty: "Save a few titles to get related picks here." });
  return relatedTo([{ kind: one.kind, tmdbId: one.tmdbId }], `Because you saved ${one.item.title}`, "Nothing related right now.");
}

/** Several watchlist titles at random, and the titles related to any of them, movies and shows mixed. */
async function likeWatchlistRow(): Promise<Result<RowResult>> {
  const saved = await savedTitles();
  const seeds = shuffle(saved).slice(0, SEEDS + 1).map((s) => ({ kind: s.kind, tmdbId: s.tmdbId }));
  return relatedTo(seeds, "More like your watchlist", "Save a few titles to get related picks here.");
}

async function tvAcclaimedRow(): Promise<Result<RowResult>> {
  return discoverRow("Acclaimed TV", "Nothing new here right now.", { kind: "TV Show", sortBy: "vote_average.desc", minVotes: 400, minRating: 8, page: randomPage(4) });
}

async function tvGenreRow(genreId: number): Promise<Result<RowResult>> {
  const genre = TV_GENRES.find((g) => g.id === genreId);
  if (!genre) return fail("Unknown genre.");
  return discoverRow(genre.label, "Nothing new here right now.", { kind: "TV Show", genreId, sortBy: "popularity.desc", minVotes: 150, minRating: 6.5, page: randomPage(3) });
}

/** The user's country for theatre listings; Canada until a location is saved. */
async function regionCode(): Promise<string> {
  const res = await services.settings.location();
  return (res.ok && res.value?.region) || "CA";
}

/** Genres the user watches most, as TMDB genre ids with a weight, for matching new releases to taste. */
async function tasteWeights(): Promise<{ weights: Map<number, number>; names: Map<number, string> }> {
  const rows = await loadStatRows();
  const weights = new Map<number, number>();
  const names = new Map<number, string>();
  if (!rows.ok) return { weights, names };
  const byName = new Map(GENRES.map((g) => [g.name, g.id]));
  for (const row of rows.value) {
    // Highly rated viewings count for more than unrated ones.
    const weight = 1 + ((row.rating ?? 6) - 6) / 4;
    for (const name of row.genres) {
      const id = byName.get(name as (typeof GENRES)[number]["name"]);
      if (id === undefined) continue;
      weights.set(id, (weights.get(id) ?? 0) + Math.max(0.25, weight));
      names.set(id, name);
    }
  }
  return { weights, names };
}

/** Orders hits by how well their genres match the user's taste; the subtitle is just the year. */
function matchTaste(hits: CatalogHit[], taste: Awaited<ReturnType<typeof tasteWeights>>): RowItem[] {
  return hits
    .map((hit) => {
      const ids = hit.genreIds ?? [];
      const score = ids.reduce((sum, id) => sum + (taste.weights.get(id) ?? 0), 0);
      return { hit, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ hit }) => ({ ...hitItem(hit), subtitle: hit.year }));
}

async function theatreRow(when: "now" | "soon"): Promise<Result<RowResult>> {
  const region = await regionCode();
  const [hits, seen, taste] = await Promise.all([services.catalog.theatres(when, region), seenSet(), tasteWeights()]);
  if (!hits.ok) return hits;
  const unique = [...new Map(hits.value.map((h) => [h.tmdbId, h])).values()];
  const items = matchTaste(unique.filter((h) => !seen.has(seenKey(h.kind, h.tmdbId))), taste).slice(0, 18);
  return ok({
    title: when === "now" ? "In theatres near you" : "Opening soon",
    items,
    empty: "Nothing new in theatres right now.",
  });
}

/** Films on the watchlist that are in theatres or opening soon. */
async function arrivingRow(): Promise<Result<RowResult>> {
  const region = await regionCode();
  const [list, now, soon] = await Promise.all([services.wanted.list(), services.catalog.theatres("now", region), services.catalog.theatres("soon", region)]);
  if (!list.ok) return list;
  const wanted = new Set(list.value.flatMap((w) => (w.category === "Movie" && w.tmdbId !== null ? [w.tmdbId] : [])));
  const items = [...(now.ok ? now.value : []), ...(soon.ok ? soon.value : [])].filter((h) => wanted.has(h.tmdbId)).map((h) => hitItem(h));
  return ok({ title: "Arriving from your list", items, empty: "Nothing on your list is opening soon." });
}

/** Loads one Home row by id. */
export function loadRow(id: string): Promise<Result<RowResult>> {
  // Rows are kept until the app reopens or Home is refreshed; the watchlist is always read fresh
  // so a title saved a moment ago shows up.
  const result = cached(`row:${id}`, () => {
    if (id === "like-movie") return likeRow("Movie");
    if (id === "like-tv") return likeRow("TV Show");
    if (id === "new-episodes") return newEpisodesRow();
    if (id === "continue") return continueRow();
    if (id === "want") return wantRow();
    if (id === "want-pick") return wantPickRow();
    if (id === "because-saved") return becauseSavedRow();
    if (id === "like-watchlist") return likeWatchlistRow();
    if (id === "tv-acclaimed") return tvAcclaimedRow();
    if (id.startsWith("tv-")) return tvGenreRow(Number(id.slice("tv-".length)));
    if (id === "favourites") return favouritesRow();
    if (id === "theatres") return theatreRow("now");
    if (id === "soon") return theatreRow("soon");
    if (id === "arriving") return arrivingRow();
    if (id === "arthouse") return artHouseRow();
    if (id === "wildcard") return wildcardRow();
    if (id.startsWith("holiday:")) return holidayRow(id.slice("holiday:".length));
    if (id.startsWith("genre-")) return genreRow(Number(id.slice("genre-".length)));
    return Promise.resolve(fail("Unknown row."));
  }, id === "want" ? 0 : id === "new-episodes" || id === "continue" ? CACHE_MS : Infinity, id !== "want" && id !== "new-episodes" && id !== "continue" && id !== "want-pick" && id !== "because-saved" && id !== "like-watchlist");
  result.then((res) => {
    if (res.ok) resolved.set(id, res);
  });
  return result;
}
