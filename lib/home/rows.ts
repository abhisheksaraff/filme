// lib/home/rows.ts
// Builds each Home row from the log, the want-to-watch list and TMDB. Results are kept for a
// while so coming back to Home does not reshuffle everything or spend more TMDB calls.
import { GENRES } from "@/lib/domain/home";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CatalogHit, CatalogKind } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

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
  items: RowItem[];
  /** Shown when the row has nothing in it. */
  empty: string;
}

const CACHE_MS = 30 * 60_000;
/** About one slot in four of a genre row is swapped for a random pick. */
const SURPRISE_RATE = 0.25;
const ROW_SIZE = 16;
const DRAMA = 18;

/** Languages the art house row draws from, one chosen at random each time. */
const ART_HOUSE_LANGUAGES = ["fr", "de", "it", "ja", "ru", "pl", "sv", "hu", "cs", "es", "pt", "da"];
/** Languages the wildcard row draws from. */
const WILDCARD_LANGUAGES = ["ko", "ja", "es", "it", "hi", "th", "tr", "sv", "pt", "zh", "fa", "pl", "da", "el", "id", "he"];

const cache = new Map<string, { at: number; value: Promise<Result<unknown>> }>();
const usedSurprises = new Set<string>();

/** Runs `make` once per key within the cache window; failures are not kept. */
function cached<T>(key: string, make: () => Promise<Result<T>>): Promise<Result<T>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<Result<T>>;
  const value = make();
  cache.set(key, { at: Date.now(), value });
  value.then((res) => {
    if (!res.ok && cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

/** Forgets every row so the next load picks fresh titles. */
export function clearHomeCache(): void {
  cache.clear();
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

function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function languageName(code: string): string {
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

/** Titles already seen; if the log cannot be read, nothing is hidden. */
async function seenSet(): Promise<Set<string>> {
  const res = await cached("seen", () => services.log.seen());
  return new Set(res.ok ? res.value : []);
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

async function recentRow(): Promise<Result<RowResult>> {
  const res = await services.log.recent(40);
  if (!res.ok) return res;
  const seen = new Set<string>();
  const items: RowItem[] = [];
  for (const entry of res.value) {
    if (seen.has(entry.mediaId)) continue;
    seen.add(entry.mediaId);
    items.push({
      key: `title:${entry.mediaId}`,
      title: entry.title,
      subtitle: entry.watchedOn,
      posterUrl: tmdbImageUrl(entry.posterPath, "w185"),
      href: `/title/?id=${entry.mediaId}`,
    });
  }
  return ok({ title: "Recently logged", items: items.slice(0, 12), empty: "Nothing logged yet." });
}

async function wantRow(): Promise<Result<RowResult>> {
  const res = await services.wanted.list();
  if (!res.ok) return res;
  const items = res.value.map((item): RowItem => {
    const kind: CatalogKind = item.category === "TV Show" ? "TV Show" : "Movie";
    return {
      key: `want:${item.mediaId}`,
      title: item.title,
      subtitle: null,
      posterUrl: tmdbImageUrl(item.posterPath, "w185"),
      href: item.tmdbId === null ? `/title/?id=${item.mediaId}` : previewHref(kind, item.tmdbId),
    };
  });
  return ok({ title: "Want to watch", items, empty: "Nothing saved yet. Search for a title and tap Want to watch." });
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

function artHouseRow(): Promise<Result<RowResult>> {
  const language = pick(ART_HOUSE_LANGUAGES);
  return discoverRow(`Art house · ${languageName(language)}`, "Nothing found. Try shuffling.", {
    kind: "Movie",
    genreId: DRAMA,
    language,
    sortBy: "vote_average.desc",
    minVotes: 400,
    minRating: 7.3,
    page: randomPage(3),
  });
}

function wildcardRow(): Promise<Result<RowResult>> {
  const language = pick(WILDCARD_LANGUAGES);
  return discoverRow(`Wildcard · ${languageName(language)}`, "Nothing found. Try shuffling.", {
    kind: "Movie",
    language,
    sortBy: "popularity.desc",
    minVotes: 150,
    minRating: 6.8,
    page: randomPage(4),
  });
}

/** Loads one Home row by id. */
export function loadRow(id: string): Promise<Result<RowResult>> {
  return cached(`row:${id}`, () => {
    if (id === "recent") return recentRow();
    if (id === "want") return wantRow();
    if (id === "favourites") return favouritesRow();
    if (id === "arthouse") return artHouseRow();
    if (id === "wildcard") return wildcardRow();
    if (id.startsWith("genre-")) return genreRow(Number(id.slice("genre-".length)));
    return Promise.resolve(fail("Unknown row."));
  });
}
