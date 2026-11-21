// lib/collectionInfo.ts
// What TMDB has no page of its own for on a collection, worked out from its films: genres, total runtime, box office, cast and crew.
import type { CatalogCredit, CatalogDetails, CollectionDetail } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

export interface CollectionPerson {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  /** How many of the collection's films they are in. */
  films: number;
}

export interface CollectionInfo {
  /** Genres by how many films carry them, most first. */
  genres: string[];
  /** Minutes, all films added up. */
  runtime: number;
  /** US dollars, all films added up; 0 when TMDB knows none. */
  revenue: number;
  cast: CollectionPerson[];
  directors: CollectionPerson[];
  writers: CollectionPerson[];
}

/** Films asked about at once, so a long franchise does not flood the catalogue. */
const BATCH = 6;
const CAST_LIMIT = 20;
const CREW_LIMIT = 12;
/** Only the billed cast counts, so a bit part does not rank above a lead. */
const BILLED = 20;

/** The people in `credits` of one role, counted across films, most films first then best billing. */
function tally(films: CatalogDetails[], role: CatalogCredit["role"], limit: number): CollectionPerson[] {
  const found = new Map<number, CollectionPerson & { best: number }>();
  for (const film of films) {
    const seenHere = new Set<number>();
    for (const c of film.credits) {
      if (c.role !== role || seenHere.has(c.tmdbId) || (role === "actor" && (c.order ?? 0) >= BILLED)) continue;
      seenHere.add(c.tmdbId);
      const now = found.get(c.tmdbId);
      if (now) {
        now.films++;
        now.best = Math.min(now.best, c.order ?? 99);
      } else found.set(c.tmdbId, { tmdbId: c.tmdbId, name: c.name, profilePath: c.profilePath, films: 1, best: c.order ?? 99 });
    }
  }
  return [...found.values()].sort((a, b) => b.films - a.films || a.best - b.best).slice(0, limit).map(({ best: _best, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export async function loadCollectionInfo(detail: CollectionDetail): Promise<CollectionInfo> {
  const films: CatalogDetails[] = [];
  for (let i = 0; i < detail.parts.length; i += BATCH) {
    const batch = await Promise.all(detail.parts.slice(i, i + BATCH).map((p) => services.catalog.details({ kind: "Movie", tmdbId: p.tmdbId })));
    for (const res of batch) if (res.ok) films.push(res.value);
  }
  const counts = new Map<string, number>();
  for (const f of films) for (const g of f.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  return {
    genres: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name),
    runtime: films.reduce((sum, f) => sum + (f.runtime ?? 0), 0),
    revenue: films.reduce((sum, f) => sum + (f.revenue ?? 0), 0),
    cast: tally(films, "actor", CAST_LIMIT),
    directors: tally(films, "director", CREW_LIMIT),
    writers: tally(films, "writer", CREW_LIMIT),
  };
}

/** "53 h 20 min", or "95 min" for under an hour. */
export function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "$7.4B" style money in US dollars. */
export function formatMoney(dollars: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(dollars);
}
