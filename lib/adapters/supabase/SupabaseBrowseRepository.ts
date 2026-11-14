// lib/adapters/supabase/SupabaseBrowseRepository.ts
// Reads people, venues and credits for the pages that link between them.
import type { BrowseRepository, PersonWork } from "@/lib/ports/browse";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const one = <T>(value: unknown): T | null => ((Array.isArray(value) ? value[0] : value) as T | undefined) ?? null;

export const supabaseBrowseRepository: BrowseRepository = {
  async titleCredits(mediaId) {
    const db = getSupabase();
    const [genres, people] = await Promise.all([
      db.from("media_genres").select("genre:genres(name)").eq("media_id", mediaId),
      db
        .from("media_people")
        .select("role, character, billing_order, person:people(id, tmdb_id, name, profile_path)")
        .eq("media_id", mediaId)
        .order("billing_order", { nullsFirst: false }),
    ]);
    if (genres.error || people.error) return fail("Could not load the credits.");
    return ok({
      genres: genres.data.flatMap((g) => one<{ name: string }>(g.genre)?.name ?? []),
      people: people.data.flatMap((row) => {
        const p = one<{ id: string; tmdb_id: number | null; name: string; profile_path: string | null }>(row.person);
        return p
          ? [{ personId: p.id, tmdbId: p.tmdb_id, name: p.name, role: row.role as string, character: row.character as string | null, profilePath: p.profile_path }]
          : [];
      }),
    });
  },

  async person(id) {
    const db = getSupabase();
    const person = await db.from("people").select("id, tmdb_id, name, profile_path").eq("id", id).maybeSingle();
    if (person.error || !person.data) return fail("Could not find that person.");

    const links = await db
      .from("media_people")
      .select("role, media:media_items(id, title, category, release_date, poster_path)")
      .eq("person_id", id);
    if (links.error) return fail("Could not load their work.");

    const mediaIds = links.data.flatMap((l) => one<{ id: string }>(l.media)?.id ?? []);
    const seen = mediaIds.length
      ? await db.from("watch_sessions").select("media_id").in("media_id", mediaIds).is("deleted_at", null)
      : { data: [] as { media_id: string }[] };
    const seenIds = new Set((seen.data ?? []).map((s) => s.media_id));

    const works = new Map<string, PersonWork>();
    for (const link of links.data) {
      const m = one<{ id: string; title: string; category: string; release_date: string | null; poster_path: string | null }>(link.media);
      if (!m) continue;
      const existing = works.get(m.id);
      if (existing) existing.roles.push(link.role as string);
      else
        works.set(m.id, {
          mediaId: m.id,
          title: m.title,
          category: m.category,
          year: m.release_date?.slice(0, 4) ?? null,
          posterPath: m.poster_path,
          roles: [link.role as string],
          seen: seenIds.has(m.id),
        });
    }
    return ok({
      id,
      tmdbId: person.data.tmdb_id as number | null,
      name: person.data.name as string,
      profilePath: person.data.profile_path as string | null,
      works: [...works.values()].sort((a, b) => (b.year ?? "").localeCompare(a.year ?? "")),
    });
  },

  async personIdByTmdb(tmdbId) {
    const { data, error } = await getSupabase().from("people").select("id").eq("tmdb_id", tmdbId).maybeSingle();
    return error ? fail("Could not look up that person.") : ok((data?.id as string | undefined) ?? null);
  },

  async venue(id) {
    const db = getSupabase();
    const venue = await db.from("venues").select("*").eq("id", id).maybeSingle();
    if (venue.error || !venue.data) return fail("Could not find that venue.");
    const sessions = await db
      .from("watch_sessions")
      .select("id, media_id, watched_on, rating, media:media_items(title, poster_path)")
      .eq("venue_id", id)
      .is("deleted_at", null)
      .order("watched_on", { ascending: false, nullsFirst: false });
    if (sessions.error) return fail("Could not load the visits.");
    const v = venue.data;
    return ok({
      id,
      name: v.name as string,
      type: v.type as string,
      address: v.address as string | null,
      city: v.city as string | null,
      country: v.country as string | null,
      latitude: v.latitude as number | null,
      longitude: v.longitude as number | null,
      viewings: sessions.data.map((s) => {
        const m = one<{ title: string; poster_path: string | null }>(s.media);
        return {
          sessionId: s.id as string,
          mediaId: s.media_id as string,
          title: m?.title ?? "Untitled",
          posterPath: m?.poster_path ?? null,
          watchedOn: s.watched_on as string | null,
          rating: s.rating === null ? null : Number(s.rating),
        };
      }),
    });
  },

  async venuePoints() {
    const db = getSupabase();
    const { data, error } = await db
      .from("venues")
      .select("id, name, city, country, latitude, longitude, sessions:watch_sessions(id)")
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    if (error) return fail("Could not load your venues.");
    return ok(
      data.map((v) => ({
        id: v.id as string,
        name: v.name as string,
        city: v.city as string | null,
        country: v.country as string | null,
        latitude: v.latitude as number,
        longitude: v.longitude as number,
        count: (v.sessions as unknown[]).length,
      })),
    );
  },

  async unlocatedVenues(limit) {
    const { data, error } = await getSupabase()
      .from("venues")
      .select("id, name, address, city")
      .is("latitude", null)
      .neq("type", "home")
      .limit(limit);
    if (error) return fail("Could not load your venues.");
    return ok(data.map((v) => ({ id: v.id as string, name: v.name as string, address: ((v.address as string | null) ?? (v.city as string | null)) })));
  },

  async setVenueLocation(id, point) {
    const { error } = await getSupabase()
      .from("venues")
      .update({ latitude: point.latitude, longitude: point.longitude, city: point.city, country: point.country })
      .eq("id", id);
    return error ? fail("Could not save the venue's position.") : ok(undefined);
  },
};
