// lib/adapters/supabase/SupabasePassRepository.ts
// Rewatch resets, the edits made to completion cards, and the completion cards themselves.
import type { Completion, PassRepository, StackEdit, Subject } from "@/lib/ports/passes";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

/** The column that says whose it is, and its value. */
const owner = (s: Subject) => (typeof s === "string" ? (["media_id", s] as const) : (["collection_id", s.collectionId] as const));

function toCompletion(r: Record<string, unknown>): Completion {
  const season = r.season as number;
  return {
    id: r.id as string,
    mediaId: (r.media_id as string | null) ?? null,
    collectionId: (r.collection_id as number | null) ?? null,
    collectionName: (r.collection_name as string | null) ?? null,
    season: season < 0 ? null : season,
    passKey: r.pass_key as string,
    lastViewingId: (r.last_viewing_id as string | null) ?? null,
    completedOn: (r.completed_on as string | null) ?? null,
    ownPictures: !!r.own_pictures,
  };
}

/** Changes some fields of a collection's follow row, creating it first when there is none. */
async function saveFollow(collectionId: number, patch: Record<string, unknown>) {
  const db = getSupabase();
  const found = await db.from("collection_follows").select("collection_id").eq("collection_id", collectionId).maybeSingle();
  if (found.error) return fail("Could not save that.");
  const res = found.data ? await db.from("collection_follows").update(patch).eq("collection_id", collectionId) : await db.from("collection_follows").insert({ collection_id: collectionId, ...patch });
  return res.error ? fail("Could not save that.") : ok(undefined);
}

export const supabasePassRepository: PassRepository = {
  async resets(subject) {
    const [col, id] = owner(subject);
    const { data, error } = await getSupabase().from("tv_resets").select("season, reset_at").eq(col, id);
    if (error) return fail("Could not load your rewatch progress.");
    return ok((data ?? []).map((r) => ({ season: (r.season as number | null) ?? null, at: r.reset_at as string })));
  },

  async reset(subject, season) {
    const [col, id] = owner(subject);
    const { error } = await getSupabase().from("tv_resets").insert({ [col]: id, season });
    return error ? fail("Could not reset that.") : ok(undefined);
  },

  async edits(subject) {
    const [col, id] = owner(subject);
    const { data, error } = await getSupabase().from("tv_stack_edits").select("season, pass_key, fields").eq(col, id);
    if (error) return fail("Could not load your edits.");
    return ok((data ?? []).map((r): StackEdit => ({ season: (r.season as number) < 0 ? null : (r.season as number), passKey: r.pass_key as string, fields: (r.fields ?? {}) as StackEdit["fields"] })));
  },

  async saveEdit(subject, season, passKey, fields) {
    const [col, id] = owner(subject);
    const db = getSupabase();
    const gone = await db.from("tv_stack_edits").delete().eq(col, id).eq("season", season ?? -1).eq("pass_key", passKey);
    if (gone.error) return fail("Could not save that.");
    const { error } = await db.from("tv_stack_edits").insert({ [col]: id, season: season ?? -1, pass_key: passKey, fields, updated_at: new Date().toISOString() });
    return error ? fail("Could not save that.") : ok(undefined);
  },

  async clearEdit(subject, season, passKey) {
    const [col, id] = owner(subject);
    const { error } = await getSupabase().from("tv_stack_edits").delete().eq(col, id).eq("season", season ?? -1).eq("pass_key", passKey);
    return error ? fail("Could not reset that.") : ok(undefined);
  },

  async allEdits() {
    const { data, error } = await getSupabase().from("tv_stack_edits").select("media_id, collection_id, season, pass_key, fields");
    if (error) return fail("Could not load your edits.");
    return ok((data ?? []).map((r) => ({ mediaId: (r.media_id as string | null) ?? null, collectionId: (r.collection_id as number | null) ?? null, season: (r.season as number) < 0 ? null : (r.season as number), passKey: r.pass_key as string, fields: (r.fields ?? {}) as StackEdit["fields"] })));
  },

  async completions() {
    const { data, error } = await getSupabase().from("tv_completions").select("*").eq("active", true).order("completed_on", { ascending: false, nullsFirst: false });
    if (error) return fail("Could not load your completed seasons.");
    return ok((data ?? []).map(toCompletion));
  },

  async syncCompletions(subject, collectionName, cards) {
    const db = getSupabase();
    const [col, id] = owner(subject);
    const existing = await db.from("tv_completions").select("id, season, pass_key, active, last_viewing_id, completed_on").eq(col, id);
    if (existing.error) return fail("Could not update your completed seasons.");
    const rows = existing.data ?? [];
    const keyOf = (season: number | null, passKey: string) => `${season ?? -1}|${passKey}`;
    const wanted = new Map(cards.map((c) => [keyOf(c.season, c.passKey), c]));

    // Cards that no longer count are hidden, not deleted, so their pictures and edits come back if they reopen and finish again.
    const hide = rows.filter((r) => r.active && !wanted.has(keyOf((r.season as number) < 0 ? null : (r.season as number), r.pass_key as string))).map((r) => r.id as string);
    if (hide.length > 0) {
      const res = await db.from("tv_completions").update({ active: false, updated_at: new Date().toISOString() }).in("id", hide);
      if (res.error) return fail("Could not update your completed seasons.");
    }
    for (const card of wanted.values()) {
      const found = rows.find((r) => keyOf((r.season as number) < 0 ? null : (r.season as number), r.pass_key as string) === keyOf(card.season, card.passKey));
      if (found) {
        if (found.active && found.last_viewing_id === card.lastViewingId && found.completed_on === card.completedOn) continue;
        const res = await db.from("tv_completions").update({ active: true, last_viewing_id: card.lastViewingId, completed_on: card.completedOn, collection_name: collectionName, updated_at: new Date().toISOString() }).eq("id", found.id as string);
        if (res.error) return fail("Could not update your completed seasons.");
      } else {
        const res = await db.from("tv_completions").insert({ [col]: id, collection_name: collectionName, season: card.season ?? -1, pass_key: card.passKey, last_viewing_id: card.lastViewingId, completed_on: card.completedOn });
        if (res.error) return fail("Could not update your completed seasons.");
      }
    }
    return ok(undefined);
  },

  async completion(subject, season, passKey) {
    const [col, id] = owner(subject);
    const { data, error } = await getSupabase().from("tv_completions").select("*").eq(col, id).eq("season", season ?? -1).eq("pass_key", passKey).maybeSingle();
    if (error) return fail("Could not load that card.");
    return ok(data ? toCompletion(data) : null);
  },

  async collectionsSeen() {
    const { data, error } = await getSupabase()
      .from("media_items")
      .select("collection_id, collection_name, watch_sessions!inner(id)")
      .not("collection_id", "is", null)
      .is("watch_sessions.deleted_at", null);
    if (error) return fail("Could not load your collections.");
    const seen = new Map<number, string | null>();
    for (const row of data ?? []) seen.set(row.collection_id as number, (row.collection_name as string | null) ?? null);
    return ok([...seen].map(([collectionId, name]) => ({ collectionId, name })));
  },

  async showsSeen() {
    const { data, error } = await getSupabase().from("watch_sessions").select("media_id, media_items!inner(category)").eq("media_items.category", "TV Show").is("deleted_at", null).limit(5000);
    if (error) return fail("Could not load your shows.");
    return ok([...new Set((data ?? []).map((r) => r.media_id as string))]);
  },

  async hideCollection(collectionId, latestAddedAt) {
    return saveFollow(collectionId, { continue_removed_after: latestAddedAt });
  },

  async setCollectionHidden(collectionId, hidden) {
    return saveFollow(collectionId, { do_not_recommend: hidden });
  },

  async hiddenCollectionIds() {
    const { data, error } = await getSupabase().from("collection_follows").select("collection_id").eq("do_not_recommend", true);
    if (error) return fail("Could not load Home.");
    return ok(new Set((data ?? []).map((r) => r.collection_id as number)));
  },

  async hiddenCollections() {
    const { data, error } = await getSupabase().from("collection_follows").select("collection_id, continue_removed_after");
    if (error) return fail("Could not load Home.");
    return ok(new Map((data ?? []).filter((r) => r.continue_removed_after).map((r) => [r.collection_id as number, r.continue_removed_after as string] as const)));
  },

  async uncheckedMovies(limit) {
    const { data, error } = await getSupabase().from("media_items").select("id, tmdb_id").eq("category", "Movie").eq("collection_checked", false).not("tmdb_id", "is", null).limit(limit);
    if (error) return fail("Could not look up your films.");
    return ok((data ?? []).map((r) => ({ mediaId: r.id as string, tmdbId: r.tmdb_id as number })));
  },

  async collectionOfMedia(mediaId) {
    const { data, error } = await getSupabase().from("media_items").select("collection_id, collection_checked").eq("id", mediaId).maybeSingle();
    if (error || !data) return fail("Could not look that up.");
    return ok(data.collection_checked ? ((data.collection_id as number | null) ?? null) : undefined);
  },

  async setCollection(mediaId, collection) {
    const { error } = await getSupabase().from("media_items").update({ collection_id: collection?.id ?? null, collection_name: collection?.name ?? null, collection_checked: true }).eq("id", mediaId);
    return error ? fail("Could not save that.") : ok(undefined);
  },

  async adoptPictures(completionId, fromSessionId) {
    const db = getSupabase();
    const mine = await db.from("tv_completions").select("own_pictures").eq("id", completionId).maybeSingle();
    if (mine.error || !mine.data) return fail("Could not find that card.");
    if (mine.data.own_pictures) return ok(undefined);
    const source = await db.from("images").select("kind, source, path, note, is_default, store, created_at").eq("session_id", fromSessionId).in("kind", ["photo", "ticket"]);
    if (source.error) return fail("Could not copy the pictures.");
    // The copies point at the same files, so nothing is uploaded again; a file is only removed once no picture uses it.
    if (source.data?.length) {
      const res = await db.from("images").insert(source.data.map((r) => ({ ...r, completion_id: completionId })));
      if (res.error) return fail("Could not copy the pictures.");
    }
    const flag = await db.from("tv_completions").update({ own_pictures: true }).eq("id", completionId);
    return flag.error ? fail("Could not copy the pictures.") : ok(undefined);
  },
};
