// lib/adapters/tmdb/EdgeCatalog.ts
// Asks TMDB questions through the `tmdb` Edge Function so the key never reaches the phone.
import type { Catalog, CatalogDetails, CatalogMatch } from "@/lib/ports/catalog";
import { fail, ok } from "@/lib/ports/result";
import { callFunction } from "../supabase/functions";
import { tmdbImageUrl } from "./images";

interface SearchHit {
  id: number;
  media_type?: string;
}
interface Named {
  name: string;
}

const year = (date?: string) => (date ? parseInt(date.slice(0, 4), 10) || null : null);

export const edgeCatalog: Catalog = {
  async findClosest(title, category) {
    if (!title.trim()) return ok(null);
    const kind = category === "TV Show" ? "tv" : category === "Movie" ? "movie" : "multi";
    const res = await callFunction<{ results: SearchHit[] }>("tmdb", {
      path: `/search/${kind}`,
      params: { query: title, include_adult: "false" },
    });
    if (!res.ok) return fail(res.error);

    // Multi-search can return people; skip them.
    const hit = res.value.results.find((r) => kind !== "multi" || r.media_type === "movie" || r.media_type === "tv");
    if (!hit) return ok(null);
    const matchKind = kind === "tv" || hit.media_type === "tv" ? "TV Show" : "Movie";
    return ok({ tmdbId: hit.id, kind: matchKind } satisfies CatalogMatch);
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
