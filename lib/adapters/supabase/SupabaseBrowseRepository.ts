// lib/adapters/supabase/SupabaseBrowseRepository.ts
// Reads people, venues and credits for the pages that link between them.
import type { BrowseRepository, PersonWork } from "@/lib/ports/browse";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { lastHomeVenue, literal } from "./venues";

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

  async searchPeople(query) {
    const q = query.trim();
    if (q.length < 2) return ok([]);
    const { data, error } = await getSupabase()
      .from("people")
      .select("id, tmdb_id, name, profile_path")
      .ilike("name", `%${literal(q)}%`)
      .order("name")
      .limit(6);
    if (error) return fail("Could not search your people.");
    return ok(data.map((p) => ({ personId: p.id as string, tmdbId: p.tmdb_id as number | null, name: p.name as string, profilePath: p.profile_path as string | null })));
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
      .select("id, media_id, watched_on, rating, media:media_items(title, poster_path, category)")
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
        const m = one<{ title: string; poster_path: string | null; category: string }>(s.media);
        return {
          sessionId: s.id as string,
          mediaId: s.media_id as string,
          title: m?.title ?? "Untitled",
          posterPath: m?.poster_path ?? null,
          watchedOn: s.watched_on as string | null,
          rating: s.rating === null ? null : Number(s.rating),
          category: m?.category ?? "Movie",
        };
      }),
    });
  },

  async venuePoints() {
    const db = getSupabase();
    const { data, error } = await db
      .from("venues")
      .select("id, name, type, city, country, latitude, longitude, sessions:watch_sessions(deleted_at, media:media_items(category))")
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    if (error) return fail("Could not load your venues.");
    return ok(
      data.flatMap((v) => {
        const counts = new Map<string, number>();
        for (const session of v.sessions as { deleted_at: string | null; media: unknown }[]) {
          if (session.deleted_at) continue;
          const category = one<{ category: string }>(session.media)?.category ?? "Movie";
          counts.set(category, (counts.get(category) ?? 0) + 1);
        }
        const kinds = [...counts.entries()].map(([category, count]) => ({ category, count }));
        if (kinds.length === 0) return [];
        return [{
          id: v.id as string,
          name: v.name as string,
          type: v.type as string,
          city: v.city as string | null,
          country: v.country as string | null,
          latitude: v.latitude as number,
          longitude: v.longitude as number,
          count: kinds.reduce((sum, k) => sum + k.count, 0),
          kinds,
        }];
      }),
    );
  },

  async searchVenues(query) {
    const q = query.trim();
    if (q.length < 2) return ok([]);
    const db = getSupabase();
    const pattern = `%${literal(q)}%`;
    const { data, error } = await db
      .from("venues")
      .select("id, name, address, type")
      .or(`name.ilike.${pattern},address.ilike.${pattern},city.ilike.${pattern}`)
      .limit(20);
    if (error) return fail("Could not search your venues.");
    const current = await lastHomeVenue(db);
    // The current home leads, then the rest by name.
    const list = (data as { id: string; name: string; address: string | null; type: string }[]).sort(
      (a, b) => Number(b.id === current?.id) - Number(a.id === current?.id) || a.name.localeCompare(b.name),
    );
    return ok(list.slice(0, 6));
  },

  async lastHome() {
    return ok(await lastHomeVenue(getSupabase()));
  },

  async unlocatedVenues(limit) {
    const { data, error } = await getSupabase()
      .from("venues")
      .select("id, name, address, city, type")
      .is("latitude", null)
      .limit(limit);
    if (error) return fail("Could not load your venues.");
    // A home without an address cannot be placed on the map.
    return ok(data.flatMap((v) => (v.type === "home" && !v.address ? [] : [{ id: v.id as string, name: v.name as string, address: ((v.address as string | null) ?? (v.city as string | null)) }])));
  },

  async setVenueLocation(id, point) {
    const { error } = await getSupabase()
      .from("venues")
      .update({ latitude: point.latitude, longitude: point.longitude, city: point.city, country: point.country })
      .eq("id", id);
    return error ? fail("Could not save the venue's position.") : ok(undefined);
  },
};
