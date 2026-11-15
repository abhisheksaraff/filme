// lib/adapters/tmdb/EdgeCatalog.ts
// Asks TMDB questions through the `tmdb` Edge Function so the key never reaches the phone.
import type { BrowseSpec, Catalog, CatalogCredit, CatalogDetails, CatalogHit, CatalogKind, CatalogMatch, CatalogPerson, CatalogPersonHit, EpisodeRef, ShowStatus } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { callFunction } from "../supabase/functions";
import { tmdbImageUrl } from "./images";

interface Named {
  name: string;
}

interface CreditRow extends SearchRow {
  media_type?: string;
}

/** Most cast members saved for one title. */
const MAX_CAST = 60;

const year = (date?: string) => (date ? parseInt(date.slice(0, 4), 10) || null : null);

interface SearchRow {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  original_language?: string;
}

function toHit(row: SearchRow, kind: CatalogKind): CatalogHit {
  return {
    tmdbId: row.id,
    kind,
    title: (kind === "TV Show" ? row.name : row.title) ?? "Untitled",
    year: (row.release_date ?? row.first_air_date ?? "").slice(0, 4) || null,
    posterUrl: tmdbImageUrl(row.poster_path, "w185"),
    releaseDate: row.release_date ?? row.first_air_date ?? null,
    genreIds: row.genre_ids ?? [],
    language: row.original_language ?? null,
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
    const dateKey = spec.kind === "TV Show" ? "first_air_date" : "primary_release_date";
    if (spec.yearFrom !== undefined) params[`${dateKey}.gte`] = `${spec.yearFrom}-01-01`;
    if (spec.yearTo !== undefined) params[`${dateKey}.lte`] = `${spec.yearTo}-12-31`;
    if (spec.personId !== undefined && spec.kind === "Movie") params.with_people = String(spec.personId);
    return listHits(`/discover/${spec.kind === "TV Show" ? "tv" : "movie"}`, params, spec.kind);
  },

  async person(tmdbId) {
    const [info, credits] = await Promise.all([
      callFunction<{ name: string; biography?: string; imdb_id?: string | null; profile_path?: string | null }>("tmdb", { path: `/person/${tmdbId}` }),
      callFunction<{ cast?: CreditRow[]; crew?: CreditRow[] }>("tmdb", { path: `/person/${tmdbId}/combined_credits` }),
    ]);
    if (!info.ok) return fail(info.error);
    const unique = new Map<string, CreditRow>();
    for (const row of [...(credits.ok ? credits.value.cast ?? [] : []), ...(credits.ok ? credits.value.crew ?? [] : [])]) {
      if (row.media_type !== "movie" && row.media_type !== "tv") continue;
      unique.set(`${row.media_type}:${row.id}`, row);
    }
    const works = [...unique.values()]
      .sort((a, b) => (b.release_date ?? b.first_air_date ?? "").localeCompare(a.release_date ?? a.first_air_date ?? ""))
      .slice(0, 60)
      .map((row) => toHit(row, row.media_type === "tv" ? "TV Show" : "Movie"));
    const person: CatalogPerson = {
      name: info.value.name,
      biography: info.value.biography || null,
      imdbId: info.value.imdb_id || null,
      profileUrl: tmdbImageUrl(info.value.profile_path, "w342"),
      works,
    };
    return ok(person);
  },

  async relatedPeople(tmdbId) {
    const credits = await callFunction<{ cast?: (CreditRow & { vote_count?: number })[]; crew?: (CreditRow & { vote_count?: number })[] }>("tmdb", { path: `/person/${tmdbId}/combined_credits` });
    if (!credits.ok) return fail(credits.error);
    const unique = new Map<string, CreditRow & { vote_count?: number }>();
    for (const row of [...(credits.value.cast ?? []), ...(credits.value.crew ?? [])]) {
      if (row.media_type === "movie" || row.media_type === "tv") unique.set(`${row.media_type}:${row.id}`, row);
    }
    // Their best-known titles, by how many people voted on them.
    const best = [...unique.values()].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 10);
    const lists = await Promise.all(best.map((row) =>
      callFunction<{ cast?: { id: number; name: string; profile_path?: string | null }[]; crew?: { id: number; name: string; job: string; profile_path?: string | null }[] }>("tmdb", { path: `/${row.media_type}/${row.id}/credits` })));
    if (lists.every((l) => !l.ok)) return fail("Could not look up who they work with.");

    const counts = new Map<number, { hit: CatalogPersonHit; n: number }>();
    for (const list of lists) {
      if (!list.ok) continue;
      const people = [
        ...(list.value.cast ?? []).slice(0, 10),
        ...(list.value.crew ?? []).filter((p) => p.job === "Director"),
      ];
      // One title counts a person once, even if they were both in it and directed it.
      for (const p of new Map(people.map((x) => [x.id, x])).values()) {
        if (p.id === tmdbId) continue;
        const entry = counts.get(p.id) ?? { hit: { tmdbId: p.id, name: p.name, profilePath: p.profile_path ?? null }, n: 0 };
        entry.n++;
        counts.set(p.id, entry);
      }
    }
    // Someone who appears alongside them only once is a coincidence, not a regular.
    return ok([...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n || a.hit.name.localeCompare(b.hit.name)).slice(0, 14).map((c) => c.hit));
  },

  async searchPeople(query) {
    if (query.trim().length < 2) return ok([]);
    const res = await callFunction<{ results: { id: number; name: string; profile_path?: string | null }[] }>("tmdb", {
      path: "/search/person",
      params: { query, include_adult: "false" },
    });
    if (!res.ok) return fail(res.error);
    return ok(res.value.results.slice(0, 5).map((p) => ({ tmdbId: p.id, name: p.name, profilePath: p.profile_path ?? null })));
  },

  async episodes(tmdbId, season) {
    if (season !== null) {
      const res = await callFunction<{ episodes?: { episode_number: number }[] }>("tmdb", { path: `/tv/${tmdbId}/season/${season}` });
      if (!res.ok) return fail(res.error);
      return ok((res.value.episodes ?? []).map((e): EpisodeRef => ({ season, episode: e.episode_number })));
    }
    const show = await callFunction<{ seasons?: { season_number: number; episode_count: number }[] }>("tmdb", { path: `/tv/${tmdbId}` });
    if (!show.ok) return fail(show.error);
    // Season 0 holds specials; the whole show means the regular seasons.
    return ok(
      (show.value.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .flatMap((s) => Array.from({ length: s.episode_count }, (_, i): EpisodeRef => ({ season: s.season_number, episode: i + 1 }))),
    );
  },

  async showStatus(tmdbId) {
    type Ep = { season_number: number; episode_number: number; name?: string; air_date?: string } | null;
    const res = await callFunction<{
      seasons?: { season_number: number; episode_count: number }[];
      last_episode_to_air?: Ep;
      next_episode_to_air?: Ep;
    }>("tmdb", { path: `/tv/${tmdbId}` });
    if (!res.ok) return fail(res.error);
    const ref = (e: Ep | undefined) =>
      e ? { season: e.season_number, episode: e.episode_number, name: e.name ?? null, airDate: e.air_date ?? null } : null;
    const status: ShowStatus = {
      seasons: (res.value.seasons ?? []).filter((s) => s.season_number > 0).map((s) => ({ season: s.season_number, episodes: s.episode_count })),
      last: ref(res.value.last_episode_to_air),
      next: ref(res.value.next_episode_to_air),
    };
    return ok(status);
  },

  async images(match) {
    const res = await callFunction<{ posters?: { file_path: string }[]; backdrops?: { file_path: string }[] }>("tmdb", {
      path: `/${match.kind === "TV Show" ? "tv" : "movie"}/${match.tmdbId}/images`,
      params: { include_image_language: "en,null" },
    });
    if (!res.ok) return fail(res.error);
    return ok({
      posters: (res.value.posters ?? []).slice(0, 30).map((p) => p.file_path),
      backdrops: (res.value.backdrops ?? []).slice(0, 30).map((p) => p.file_path),
    });
  },

  async theatres(when, region) {
    const path = when === "now" ? "/movie/now_playing" : "/movie/upcoming";
    const pages = await Promise.all([1, 2].map((page) => listHits(path, { region, page: String(page) }, "Movie")));
    if (pages.every((page) => !page.ok)) return pages[0].ok ? ok([]) : fail(pages[0].error);
    return ok(pages.flatMap((page) => (page.ok ? page.value : [])));
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
      params: { append_to_response: isMovie ? "credits" : "aggregate_credits,external_ids" },
    });
    if (!res.ok) return fail(res.error);
    const d = res.value;

    const crew: { id: number; name: string; job: string; profile_path?: string | null }[] = d.credits?.crew ?? [];
    const cast: { id: number; name: string; character?: string; roles?: { character?: string }[]; order?: number; profile_path?: string | null }[] =
      (isMovie ? d.credits?.cast : d.aggregate_credits?.cast) ?? [];

    const credits: CatalogCredit[] = [
      // The whole billed cast, up to a limit so a long-running show does not save hundreds of bit parts.
      ...cast.slice(0, MAX_CAST).map((p, i): CatalogCredit => ({
        tmdbId: p.id,
        name: p.name,
        role: "actor",
        character: (isMovie ? p.character : p.roles?.[0]?.character) || null,
        order: p.order ?? i,
        profilePath: p.profile_path ?? null,
      })),
      ...(isMovie
        ? crew.flatMap((p): CatalogCredit[] => {
            const role = p.job === "Director" ? "director"
              : p.job === "Producer" || p.job === "Executive Producer" ? "producer"
              : p.job === "Screenplay" || p.job === "Writer" ? "writer" : null;
            return role ? [{ tmdbId: p.id, name: p.name, role, character: null, order: null, profilePath: p.profile_path ?? null }] : [];
          })
        : ((d.created_by ?? []) as { id: number; name: string; profile_path?: string | null }[]).map(
            (p): CatalogCredit => ({ tmdbId: p.id, name: p.name, role: "creator", character: null, order: null, profilePath: p.profile_path ?? null }),
          )),
    ];

    const details: CatalogDetails = {
      tmdbId: d.id,
      imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
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
      genreList: ((d.genres ?? []) as { id: number; name: string }[]).map((g) => ({ id: g.id, name: g.name })),
      credits,
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
