// lib/adapters/supabase/SupabaseCollectionRepository.ts
// Hand-made lists of titles. Removing a collection never removes the titles in it.
import type { CollectionDetail, CollectionItem, CollectionRepository, CollectionSummary } from "@/lib/ports/collections";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { findOrCreateMedia } from "./SupabaseLogRepository";

/** Postgres code for a unique-constraint clash, which here just means "already in the collection". */
const DUPLICATE = "23505";

interface MediaRow {
  title: string;
  category: string;
  tmdb_id: number | null;
  poster_path: string | null;
  release_date: string | null;
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] : value) ?? null;

export const supabaseCollectionRepository: CollectionRepository = {
  async list() {
    const { data, error } = await getSupabase()
      .from("collections")
      .select("id, name, description, collection_items(position, media:media_items(poster_path))")
      .order("created_at", { ascending: false });
    if (error) return fail("Could not load your collections.");

    const rows: CollectionSummary[] = data.map((row) => {
      const items = ((row.collection_items ?? []) as { position: number | null; media: unknown }[])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        count: items.length,
        posterPaths: items
          .map((item) => one(item.media as { poster_path: string | null } | { poster_path: string | null }[] | null)?.poster_path)
          .filter((path): path is string => Boolean(path))
          .slice(0, 3),
      };
    });
    return ok(rows);
  },

  async create(name, description) {
    const { data, error } = await getSupabase()
      .from("collections")
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select("id")
      .single();
    return error ? fail("Could not create the collection.") : ok(data.id as string);
  },

  async update(id, name, description) {
    const { error } = await getSupabase()
      .from("collections")
      .update({ name: name.trim(), description: description?.trim() || null })
      .eq("id", id);
    return error ? fail("Could not save the collection.") : ok(undefined);
  },

  async remove(id) {
    const { error } = await getSupabase().from("collections").delete().eq("id", id);
    return error ? fail("Could not delete the collection.") : ok(undefined);
  },

  async get(id) {
    const db = getSupabase();
    const collection = await db.from("collections").select("id, name, description").eq("id", id).maybeSingle();
    if (collection.error || !collection.data) return fail("Could not find that collection.");

    const items = await db
      .from("collection_items")
      .select("media_id, position, media:media_items(title, category, tmdb_id, poster_path, release_date)")
      .eq("collection_id", id)
      .order("position");
    if (items.error) return fail("Could not load the collection.");

    const detail: CollectionDetail = {
      id: collection.data.id,
      name: collection.data.name,
      description: collection.data.description,
      items: items.data.map((row): CollectionItem => {
        const media = one(row.media as MediaRow | MediaRow[] | null);
        return {
          mediaId: row.media_id as string,
          tmdbId: media?.tmdb_id ?? null,
          category: media?.category ?? "Movie",
          title: media?.title ?? "Untitled",
          year: media?.release_date?.slice(0, 4) ?? null,
          posterPath: media?.poster_path ?? null,
        };
      }),
    };
    return ok(detail);
  },

  async addMedia(id, mediaId) {
    const db = getSupabase();
    const count = await db.from("collection_items").select("media_id", { count: "exact", head: true }).eq("collection_id", id);
    if (count.error) return fail("Could not add it to the collection.");
    const { error } = await db
      .from("collection_items")
      .insert({ collection_id: id, media_id: mediaId, position: count.count ?? 0 });
    if (error && error.code !== DUPLICATE) return fail("Could not add it to the collection.");
    return ok(undefined);
  },

  async addCatalog(id, d) {
    const media = await findOrCreateMedia(getSupabase(), {
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
    return this.addMedia(id, media.value);
  },

  async removeMedia(id, mediaId) {
    const { error } = await getSupabase().from("collection_items").delete().eq("collection_id", id).eq("media_id", mediaId);
    return error ? fail("Could not remove it from the collection.") : ok(undefined);
  },
};
