// lib/adapters/supabase/credits.ts
// Saves a title's genres, cast and crew so statistics can group by them.
import type { CatalogDetails } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";

/** Replaces the saved genres and credits of a title with what the catalogue says now. */
export async function saveCredits(mediaId: string, details: Pick<CatalogDetails, "genreList" | "credits">): Promise<Result<void>> {
  const db = getSupabase();

  if (details.genreList.length > 0) {
    const genres = await db.from("genres").upsert(details.genreList, { onConflict: "id" });
    if (genres.error) return fail("Could not save genres.");
    await db.from("media_genres").delete().eq("media_id", mediaId);
    const links = await db
      .from("media_genres")
      .insert(details.genreList.map((g) => ({ media_id: mediaId, genre_id: g.id })));
    if (links.error) return fail("Could not save genres.");
  }

  if (details.credits.length > 0) {
    const unique = [...new Map(details.credits.map((c) => [c.tmdbId, c])).values()];
    const people = await db
      .from("people")
      .upsert(
        unique.map((c) => ({ tmdb_id: c.tmdbId, name: c.name, profile_path: c.profilePath, updated_at: new Date().toISOString() })),
        { onConflict: "tmdb_id" },
      )
      .select("id, tmdb_id");
    if (people.error) return fail("Could not save the cast.");
    const idByTmdb = new Map(people.data.map((p) => [p.tmdb_id as number, p.id as string]));

    // Performers and openers added by hand are kept; only catalogue roles are replaced.
    await db.from("media_people").delete().eq("media_id", mediaId).in("role", ["actor", "director", "producer", "writer", "creator"]);
    const rows = details.credits.flatMap((c) => {
      const personId = idByTmdb.get(c.tmdbId);
      return personId ? [{ media_id: mediaId, person_id: personId, role: c.role, character: c.character, billing_order: c.order }] : [];
    });
    const links = await db.from("media_people").upsert(rows, { onConflict: "media_id,person_id,role" });
    if (links.error) return fail("Could not save the cast.");
  }

  await db.from("media_items").update({ last_synced_at: new Date().toISOString() }).eq("id", mediaId);
  return ok(undefined);
}

/** Adds a performer or opener typed by hand (or found on MusicBrainz) to a concert or live event. */
export async function addPerformer(
  mediaId: string,
  performer: { name: string; musicbrainzId: string | null },
  role: "performer" | "opener",
): Promise<Result<void>> {
  const db = getSupabase();
  const existing = performer.musicbrainzId
    ? await db.from("people").select("id").eq("musicbrainz_id", performer.musicbrainzId).maybeSingle()
    : await db.from("people").select("id").is("tmdb_id", null).is("musicbrainz_id", null).ilike("name", performer.name).maybeSingle();
  let personId = existing.data?.id as string | undefined;
  if (!personId) {
    const created = await db
      .from("people")
      .insert({ name: performer.name, musicbrainz_id: performer.musicbrainzId })
      .select("id")
      .single();
    if (created.error) return fail("Could not save the performer.");
    personId = created.data.id as string;
  }
  const link = await db
    .from("media_people")
    .upsert({ media_id: mediaId, person_id: personId, role }, { onConflict: "media_id,person_id,role" });
  return link.error ? fail("Could not save the performer.") : ok(undefined);
}
