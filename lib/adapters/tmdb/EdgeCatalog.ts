// lib/adapters/tmdb/EdgeCatalog.ts
// Asks TMDB questions through the `tmdb` Edge Function so the key never reaches the phone.
import type { Catalog, CatalogDetails, CatalogHit, CatalogMatch } from "@/lib/ports/catalog";
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

async function search(title: string, category: string): Promise<Result<CatalogHit[]>> {
  // TMDB only knows films and shows; concerts and live events are saved as custom titles.
  if (title.trim().length < 2 || (category !== "Movie" && category !== "TV Show")) return ok([]);
  const isTv = category === "TV Show";
  const res = await callFunction<{ results: SearchRow[] }>("tmdb", {
    path: `/search/${isTv ? "tv" : "movie"}`,
    params: { query: title, include_adult: "false" },
  });
  if (!res.ok) return fail(res.error);

  return ok(
    res.value.results.slice(0, 6).map((row) => ({
      tmdbId: row.id,
      kind: isTv ? ("TV Show" as const) : ("Movie" as const),
      title: (isTv ? row.name : row.title) ?? "Untitled",
      year: (row.release_date ?? row.first_air_date ?? "").slice(0, 4) || null,
      posterUrl: tmdbImageUrl(row.poster_path, "w185"),
    })),
  );
}

export const edgeCatalog: Catalog = {
  search,

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
