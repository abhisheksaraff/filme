// lib/adapters/supabase/SupabaseWantedRepository.ts
// The want-to-watch list: titles saved from the catalogue without a viewing.
import type { WantedItem, WantedRepository } from "@/lib/ports/wanted";
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
}

export const supabaseWantedRepository: WantedRepository = {
  async list() {
    const { data, error } = await getSupabase()
      .from("want_to_watch")
      .select("media_id, media:media_items(title, category, tmdb_id, poster_path)")
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
      };
    });
    return ok(items);
  },

  async add(d) {
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

    const { error } = await db.from("want_to_watch").insert({ media_id: media.value });
    if (error && error.code !== DUPLICATE) return fail("Could not add it to your list.");
    return ok(media.value);
  },

  async remove(mediaId) {
    const { error } = await getSupabase().from("want_to_watch").delete().eq("media_id", mediaId);
    return error ? fail("Could not remove it from your list.") : ok(undefined);
  },

  async status(kind, tmdbId) {
    const db = getSupabase();
    const media = await db.from("media_items").select("id").eq("category", kind).eq("tmdb_id", tmdbId).maybeSingle();
    if (media.error) return fail("Could not check this title.");
    if (!media.data) return ok({ mediaId: null, wanted: false, logged: false });

    const id = media.data.id as string;
    const [want, logged] = await Promise.all([
      db.from("want_to_watch").select("id", { count: "exact", head: true }).eq("media_id", id),
      db.from("watch_sessions").select("id", { count: "exact", head: true }).eq("media_id", id).is("deleted_at", null),
    ]);
    if (want.error || logged.error) return fail("Could not check this title.");
    return ok({ mediaId: id, wanted: (want.count ?? 0) > 0, logged: (logged.count ?? 0) > 0 });
  },
};
