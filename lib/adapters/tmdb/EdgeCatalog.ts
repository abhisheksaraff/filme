// lib/adapters/tmdb/EdgeCatalog.ts
// Asks TMDB questions through the `tmdb` Edge Function so the key never reaches the phone.
import type { BrowseSpec, Catalog, CatalogDetails, CatalogHit, CatalogKind, CatalogMatch } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { callFunction } from "../supabase/functions";
import { tmdbImageUrl } from "./images";

interface Named {
  name: string;
}

const year = (date?: string) => (date ? parseInt(date.slice(0, 4), 10) || null : null);

interface SearchRow {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

function toHit(row: SearchRow, kind: CatalogKind): CatalogHit {
  return {
    tmdbId: row.id,
    kind,
    title: (kind === "TV Show" ? row.name : row.title) ?? "Untitled",
    year: (row.release_date ?? row.first_air_date ?? "").slice(0, 4) || null,
    posterUrl: tmdbImageUrl(row.poster_path, "w185"),
  };
}

async function listHits(path: string, params: Record<string, string>, kind: CatalogKind): Promise<Result<CatalogHit[]>> {
  const res = await callFunction<{ results: SearchRow[] }>("tmdb", { path, params });
  if (!res.ok) return fail(res.error);
  return ok(res.value.results.map((row) => toHit(row, kind)));
}

async function search(title: string, category: string): Promise<Result<CatalogHit[]>> {
  // TMDB only knows films and shows; concerts and live events are saved as custom titles.
  if (title.trim().length < 2 || (category !== "Movie" && category !== "TV Show")) return ok([]);
  const isTv = category === "TV Show";
  const hits = await listHits(`/search/${isTv ? "tv" : "movie"}`, { query: title, include_adult: "false" }, category);
  return hits.ok ? ok(hits.value.slice(0, 6)) : hits;
}

export const edgeCatalog: Catalog = {
  search,

  browse(spec: BrowseSpec) {
    const params: Record<string, string> = {
      include_adult: "false",
      sort_by: spec.sortBy,
      page: String(spec.page ?? 1),
    };
    if (spec.genreId !== undefined) params.with_genres = String(spec.genreId);
    if (spec.language) params.with_original_language = spec.language;
    if (spec.minVotes !== undefined) params["vote_count.gte"] = String(spec.minVotes);
    if (spec.minRating !== undefined) params["vote_average.gte"] = String(spec.minRating);
    return listHits(`/discover/${spec.kind === "TV Show" ? "tv" : "movie"}`, params, spec.kind);
  },

  recommendations(match) {
    return listHits(`/${match.kind === "TV Show" ? "tv" : "movie"}/${match.tmdbId}/recommendations`, {}, match.kind);
  },

  async findClosest(title, category) {
    const hits = await search(title, category ?? "Movie");
    if (!hits.ok) return hits;
    const top = hits.value[0];
    return ok(top ? ({ tmdbId: top.tmdbId, kind: top.kind } satisfies CatalogMatch) : null);
  },

  async details(match) {
    const isMovie = match.kind === "Movie";
    const res = await callFunction<Record<string, any>>("tmdb", { // eslint-disable-line @typescript-eslint/no-explicit-any
      path: `/${isMovie ? "movie" : "tv"}/${match.tmdbId}`,
      params: { append_to_response: isMovie ? "credits" : "aggregate_credits" },
    });
    if (!res.ok) return fail(res.error);
    const d = res.value;

    const crew: { name: string; job: string }[] = d.credits?.crew ?? [];
    const cast: Named[] = (isMovie ? d.credits?.cast : d.aggregate_credits?.cast) ?? [];

    const details: CatalogDetails = {
      tmdbId: d.id,
      imdbId: d.imdb_id ?? null,
      category: match.kind,
      title: isMovie ? d.title : d.name,
      originalTitle: (isMovie ? d.original_title : d.original_name) || null,
      releaseDate: (isMovie ? d.release_date : d.first_air_date) || null,
      overview: d.overview || null,
      runtime: d.runtime || null,
      releaseYear: year(isMovie ? d.release_date : d.first_air_date),
      originalLanguage: d.original_language || null,
      voteAverage: d.vote_average || null,
      voteCount: d.vote_count || null,
      genres: (d.genres ?? []).map((g: Named) => g.name),
      directors: isMovie
        ? crew.filter((p) => p.job === "Director").map((p) => p.name)
        : (d.created_by ?? []).map((p: Named) => p.name),
      producers: isMovie ? crew.filter((p) => p.job === "Producer" || p.job === "Executive Producer").map((p) => p.name) : [],
      cast: cast.slice(0, 10).map((p) => p.name),
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      posterUrl: tmdbImageUrl(d.poster_path),
      backdropUrl: tmdbImageUrl(d.backdrop_path, "w780"),
    };
    return ok(details);
  },
};
