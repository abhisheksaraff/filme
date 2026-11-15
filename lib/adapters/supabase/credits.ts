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

  // People the user removed from this title stay removed.
  const media = await db.from("media_items").select("hidden_credits").eq("id", mediaId).maybeSingle();
  const hidden = new Set<string>((media.data?.hidden_credits as string[] | null) ?? []);
  const credits = [...new Map(details.credits.filter((c) => !hidden.has(`${c.tmdbId}:${c.role}`)).map((c) => [`${c.tmdbId}:${c.role}`, c])).values()];

  if (details.credits.length > 0) {
    const unique = [...new Map(credits.map((c) => [c.tmdbId, c])).values()];
    const people = unique.length === 0 ? { data: [], error: null } : await db
      .from("people")
      .upsert(
        unique.map((c) => ({ tmdb_id: c.tmdbId, name: c.name, profile_path: c.profilePath, updated_at: new Date().toISOString() })),
        { onConflict: "tmdb_id" },
      )
      .select("id, tmdb_id");
    if (people.error) return fail("Could not save the cast.");
    const idByTmdb = new Map(people.data.map((p) => [p.tmdb_id as number, p.id as string]));

    // People added by hand (no catalogue id) and performers are kept; only catalogue credits are replaced.
    const old = await db
      .from("media_people")
      .select("person_id, person:people!inner(tmdb_id)")
      .eq("media_id", mediaId)
      .in("role", ["actor", "director", "producer", "writer", "creator"])
      .not("person.tmdb_id", "is", null)
      // Cast added by hand is stored with billing_order -1 and is never replaced.
      .or("billing_order.is.null,billing_order.neq.-1");
    const oldIds = (old.data ?? []).map((row) => row.person_id as string);
    if (oldIds.length > 0) {
      await db.from("media_people").delete().eq("media_id", mediaId).in("person_id", oldIds).in("role", ["actor", "director", "producer", "writer", "creator"]);
    }
    const rows = credits.flatMap((c) => {
      const personId = idByTmdb.get(c.tmdbId);
      return personId ? [{ media_id: mediaId, person_id: personId, role: c.role, character: c.character, billing_order: c.order }] : [];
    });
    const links = rows.length > 0 ? await db.from("media_people").upsert(rows, { onConflict: "media_id,person_id,role" }) : null;
    if (links?.error) return fail("Could not save the cast.");
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

/** Someone the user chose in a cast or crew row: from their history, from the catalogue, or typed by hand. */
export interface StarringPick {
  personId: string | null;
  tmdbId: number | null;
  name: string;
  profilePath: string | null;
  /** Billing order and character, kept when the person came from a catalogue match. */
  order?: number | null;
  character?: string | null;
  /** True when the form filled this person in from the matched title rather than the user choosing them. */
  fromMatch?: boolean;
}

export type PersonRole = "actor" | "director" | "producer" | "writer" | "creator";

/** One person in one role, as added to or removed from a title's rows. */
export interface PeopleChange {
  role: PersonRole;
  pick: StarringPick;
}

/** Finds the person's row, creating it when they are new. */
async function personIdFor(pick: StarringPick): Promise<string | null> {
  const db = getSupabase();
  if (pick.personId) return pick.personId;
  if (pick.tmdbId !== null) {
    const saved = await db
      .from("people")
      .upsert({ tmdb_id: pick.tmdbId, name: pick.name, profile_path: pick.profilePath, updated_at: new Date().toISOString() }, { onConflict: "tmdb_id" })
      .select("id")
      .single();
    return saved.error ? null : (saved.data.id as string);
  }
  // Typed by hand: reuse an earlier hand-entered person with the same name.
  const existing = await db.from("people").select("id").is("tmdb_id", null).is("musicbrainz_id", null).ilike("name", pick.name).limit(1).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const created = await db.from("people").insert({ name: pick.name }).select("id").single();
  return created.error ? null : (created.data.id as string);
}

/**
 * Applies what the user did in the cast and crew rows: links people they added (by hand, billing
 * order -1 so a refresh never drops them) and removes the ones they took out, remembering removed
 * catalogue people so a later refresh from TMDB does not add them back.
 */
export async function savePeople(mediaId: string, added: PeopleChange[], removed: PeopleChange[]): Promise<Result<void>> {
  const db = getSupabase();
  const media = await db.from("media_items").select("hidden_credits").eq("id", mediaId).maybeSingle();
  const hidden = new Set<string>((media.data?.hidden_credits as string[] | null) ?? []);

  for (const { role, pick } of removed) {
    if (pick.tmdbId !== null) hidden.add(`${pick.tmdbId}:${role}`);
    let personId = pick.personId;
    if (!personId && pick.tmdbId !== null) {
      const found = await db.from("people").select("id").eq("tmdb_id", pick.tmdbId).maybeSingle();
      personId = (found.data?.id as string | undefined) ?? null;
    }
    if (personId) {
      const gone = await db.from("media_people").delete().eq("media_id", mediaId).eq("person_id", personId).eq("role", role);
      if (gone.error) return fail("Could not remove someone from the cast.");
    }
  }

  for (const { role, pick } of added) {
    const personId = await personIdFor(pick);
    if (!personId) return fail("Could not save the cast.");
    if (pick.tmdbId !== null) hidden.delete(`${pick.tmdbId}:${role}`);
    const link = await db
      .from("media_people")
      .upsert({ media_id: mediaId, person_id: personId, role, character: pick.character ?? null, billing_order: -1 }, { onConflict: "media_id,person_id,role" });
    if (link.error) return fail("Could not save the cast.");
  }

  const saved = await db.from("media_items").update({ hidden_credits: [...hidden] }).eq("id", mediaId);
  return saved.error ? fail("Could not save the cast.") : ok(undefined);
}
