// lib/adapters/supabase/SupabaseWantedRepository.ts
// The want-to-watch list: titles saved from the catalogue without a viewing.
import type { WantedItem, WantedRepository, WantScope } from "@/lib/ports/wanted";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { findOrCreateMedia } from "./SupabaseLogRepository";

/** Postgres code for a unique-constraint clash, which here just means "already on the list". */
const DUPLICATE = "23505";

interface MediaRow {
  title: string;
  category: string;
  tmdb_id: number | null;
  poster_path: string | null;
  release_date: string | null;
}

const WHOLE: WantScope = { season: null, episode: null };

/** Narrows a want_to_watch query to one scope; null columns need the "is" operator, not "eq". */
function inScope<Q extends { filter: (column: string, operator: string, value: unknown) => Q }>(query: Q, scope: WantScope): Q {
  const withSeason = query.filter("season_number", scope.season === null ? "is" : "eq", scope.season);
  return withSeason.filter("episode_number", scope.episode === null ? "is" : "eq", scope.episode);
}

export const supabaseWantedRepository: WantedRepository = {
  async list() {
    const { data, error } = await getSupabase()
      .from("want_to_watch")
      .select("media_id, season_number, episode_number, media:media_items(title, category, tmdb_id, poster_path, release_date)")
      .is("cleared_at", null)
      .order("added_at", { ascending: false });
    if (error) return fail("Could not load your want-to-watch list.");

    const items: WantedItem[] = data.map((row) => {
      const media = (Array.isArray(row.media) ? row.media[0] : row.media) as MediaRow | null;
      return {
        mediaId: row.media_id as string,
        tmdbId: media?.tmdb_id ?? null,
        category: media?.category ?? "Movie",
        title: media?.title ?? "Untitled",
        posterPath: media?.poster_path ?? null,
        releaseDate: media?.release_date ?? null,
        season: (row.season_number as number | null) ?? null,
        episode: (row.episode_number as number | null) ?? null,
      };
    });
    return ok(items);
  },

  async add(d, scope = WHOLE) {
    const db = getSupabase();
    const media = await findOrCreateMedia(db, {
      category: d.category,
      title: d.title,
      media: {
        tmdbId: d.tmdbId,
        imdbId: d.imdbId,
        title: d.title,
        originalTitle: d.originalTitle,
        originalLanguage: d.originalLanguage,
        releaseDate: d.releaseDate,
        runtime: d.runtime,
        overview: d.overview,
        voteAverage: d.voteAverage,
        voteCount: d.voteCount,
        posterPath: d.posterPath,
        backdropPath: d.backdropPath,
      },
    });
    if (!media.ok) return media;

    const { error } = await db.from("want_to_watch").insert({ media_id: media.value, season_number: scope.season, episode_number: scope.episode });
    if (error && error.code !== DUPLICATE) return fail("Could not add it to your list.");
    // A title cleared earlier by watching it goes back on the list as new.
    if (error) {
      const again = await db
        .from("want_to_watch")
        .update({ cleared_at: null, added_at: new Date().toISOString() })
        .eq("media_id", media.value)
        .not("cleared_at", "is", null)
        .filter("season_number", scope.season === null ? "is" : "eq", scope.season)
        .filter("episode_number", scope.episode === null ? "is" : "eq", scope.episode);
      if (again.error) return fail("Could not add it to your list.");
    }
    return ok(media.value);
  },

  async remove(mediaId, scope = WHOLE) {
    const { error } = await inScope(getSupabase().from("want_to_watch").delete().eq("media_id", mediaId), scope);
    return error ? fail("Could not remove it from your list.") : ok(undefined);
  },

  async cleared() {
    const { data, error } = await getSupabase().from("want_to_watch").select("added_at, cleared_at").not("cleared_at", "is", null);
    if (error) return fail("Could not load your cleared Watchlist items.");
    return ok(data.map((row) => ({ addedAt: row.added_at as string, clearedAt: row.cleared_at as string })));
  },

  async collections() {
    const { data, error } = await getSupabase().from("collection_follows").select("collection_id, name, poster_path").not("wanted_at", "is", null).order("wanted_at", { ascending: false });
    if (error) return fail("Could not load your saved collections.");
    return ok((data ?? []).map((r) => ({ collectionId: r.collection_id as number, name: (r.name as string | null) ?? "Collection", posterPath: (r.poster_path as string | null) ?? null })));
  },

  async setCollectionWanted(collection, wanted) {
    const db = getSupabase();
    const found = await db.from("collection_follows").select("collection_id").eq("collection_id", collection.collectionId).maybeSingle();
    if (found.error) return fail("Could not save that.");
    const patch = wanted ? { name: collection.name, poster_path: collection.posterPath, wanted_at: new Date().toISOString() } : { wanted_at: null };
    const res = found.data
      ? await db.from("collection_follows").update(patch).eq("collection_id", collection.collectionId)
      : await db.from("collection_follows").insert({ collection_id: collection.collectionId, ...patch });
    return res.error ? fail("Could not save that.") : ok(undefined);
  },

  async status(kind, tmdbId, scope = WHOLE) {
    const db = getSupabase();
    const media = await db.from("media_items").select("id").eq("category", kind).eq("tmdb_id", tmdbId).maybeSingle();
    if (media.error) return fail("Could not check this title.");
    if (!media.data) return ok({ mediaId: null, wanted: false, logged: false });

    const id = media.data.id as string;
    const [want, logged] = await Promise.all([
      inScope(db.from("want_to_watch").select("id", { count: "exact", head: true }).eq("media_id", id).is("cleared_at", null), scope),
      db.from("watch_sessions").select("id", { count: "exact", head: true }).eq("media_id", id).is("deleted_at", null),
    ]);
    if (want.error || logged.error) return fail("Could not check this title.");
    return ok({ mediaId: id, wanted: (want.count ?? 0) > 0, logged: (logged.count ?? 0) > 0 });
  },
};
