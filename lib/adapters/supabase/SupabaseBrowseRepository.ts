// lib/adapters/supabase/SupabaseBrowseRepository.ts
// Reads people, venues and credits for the pages that link between them.
import type { BrowseRepository, OwnVenue, PersonPick, PersonWork, VenueViewing } from "@/lib/ports/browse";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { effectiveVenueType, normalizeVenueType } from "@/lib/domain/venueTypes";
import { lastHomeVenue, literal } from "./venues";

const one = <T>(value: unknown): T | null => ((Array.isArray(value) ? value[0] : value) as T | undefined) ?? null;

type VenueRow = { id: string; name: string; address: string | null; type: string };

/** Venues that have been used, the ones watched at most recently first. */
async function rankVenues(db: ReturnType<typeof getSupabase>, venues: VenueRow[]): Promise<Result<OwnVenue[]>> {
  if (venues.length === 0) return ok([]);

  // When each was last used, and as what kind of place, so the ones visited most recently lead.
  const used = await db
    .from("watch_sessions")
    .select("venue_id, watched_on, created_at, venue_type")
    .in("venue_id", venues.map((v) => v.id))
    .is("deleted_at", null)
    .order("watched_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (used.error) return fail("Could not search your venues.");
  const last = new Map<string, { on: string | null; at: string; type: string | null }>();
  for (const row of used.data as { venue_id: string; watched_on: string | null; created_at: string; venue_type: string | null }[]) {
    const known = last.get(row.venue_id);
    // A dated viewing beats an undated one; among dated ones the rows already arrive newest first.
    if (!known || (known.on === null && row.watched_on !== null)) last.set(row.venue_id, { on: row.watched_on, at: row.created_at, type: row.venue_type });
  }
  const rank = (id: string) => last.get(id)?.on ?? "";
  // A venue only its deleted viewings used is not suggested; it is gone for good once those are.
  const list = venues
    .filter((v) => last.has(v.id))
    .map((v) => ({ ...v, lastType: last.has(v.id) ? normalizeVenueType(last.get(v.id)?.type ?? v.type) : null, lastWatchedOn: last.get(v.id)?.on ?? null }))
    .sort((a, b) => Number(last.has(b.id)) - Number(last.has(a.id)) || rank(b.id).localeCompare(rank(a.id)) || (last.get(b.id)?.at ?? "").localeCompare(last.get(a.id)?.at ?? "") || a.name.localeCompare(b.name));
  return ok(list.slice(0, 20));
}

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
          ? [{ personId: p.id, tmdbId: p.tmdb_id, name: p.name, role: row.role as string, character: row.character as string | null, profilePath: p.profile_path, order: row.billing_order as number | null }]
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

  async savedRelated(tmdbId) {
    const { data, error } = await getSupabase().from("related_people").select("people").eq("tmdb_id", tmdbId).maybeSingle();
    if (error) return fail("Could not load related people.");
    return ok(data ? (data.people as PersonPick[]) : null);
  },

  async saveRelated(tmdbId, people) {
    const { error } = await getSupabase().from("related_people").upsert({ tmdb_id: tmdbId, people, computed_at: new Date().toISOString() }, { onConflict: "user_id,tmdb_id" });
    return error ? fail("Could not save related people.") : ok(undefined);
  },

  async relatedFromLog(personId) {
    const db = getSupabase();
    const mine = await db.from("media_people").select("media_id").eq("person_id", personId);
    if (mine.error) return fail("Could not load related people.");
    const mediaIds = [...new Set(mine.data.map((r) => r.media_id as string))];
    if (mediaIds.length === 0) return ok([]);
    const others = await db
      .from("media_people")
      .select("person_id, person:people(id, tmdb_id, name, profile_path)")
      .in("media_id", mediaIds)
      .neq("person_id", personId);
    if (others.error) return fail("Could not load related people.");
    const counts = new Map<string, { pick: PersonPick; n: number }>();
    for (const row of others.data) {
      const p = one<{ id: string; tmdb_id: number | null; name: string; profile_path: string | null }>(row.person);
      if (!p) continue;
      const entry = counts.get(p.id) ?? { pick: { personId: p.id, tmdbId: p.tmdb_id, name: p.name, profilePath: p.profile_path }, n: 0 };
      entry.n++;
      counts.set(p.id, entry);
    }
    return ok([...counts.values()].sort((a, b) => b.n - a.n || a.pick.name.localeCompare(b.pick.name)).slice(0, 14).map((c) => c.pick));
  },

  async venue(id) {
    const db = getSupabase();
    const venue = await db.from("venues").select("*").eq("id", id).maybeSingle();
    if (venue.error || !venue.data) return fail("Could not find that venue.");
    const sessions = await db
      .from("watch_sessions")
      .select("id, media_id, watched_on, watched_at, rating, auditorium, seats, total_tickets, primary_format, addons, venue_type, media:media_items(title, poster_path, category, vote_average, imdb_rating, release_date)")
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
        const m = one<{ title: string; poster_path: string | null; category: string; vote_average: number | null; imdb_rating: number | null; release_date: string | null }>(s.media);
        return {
          sessionId: s.id as string,
          mediaId: s.media_id as string,
          title: m?.title ?? "Untitled",
          posterPath: m?.poster_path ?? null,
          watchedOn: s.watched_on as string | null,
          rating: s.rating === null ? null : Number(s.rating),
          publicScore: m?.imdb_rating != null ? Number(m.imdb_rating) : m?.vote_average != null ? Number(m.vote_average) : null,
          releaseDate: m?.release_date ?? null,
          category: m?.category ?? "Movie",
          watchedAt: s.watched_at as string | null,
          auditorium: s.auditorium as string | null,
          seats: (s.seats ?? []) as VenueViewing["seats"],
          totalTickets: s.total_tickets as number | null,
          primaryFormat: s.primary_format as string | null,
          addons: (s.addons ?? []) as string[],
          venueType: effectiveVenueType(s.venue_type as string | null, v.type as string, m?.category ?? "Movie"),
        };
      }),
    });
  },

  async venuePoints() {
    const db = getSupabase();
    const { data, error } = await db
      .from("venues")
      .select("id, name, type, city, country, latitude, longitude, sessions:watch_sessions(deleted_at, venue_type, media:media_items(category))")
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    if (error) return fail("Could not load your venues.");
    return ok(
      data.flatMap((v) => {
        const counts = new Map<string, number>();
        const typeCounts = new Map<string, number>();
        for (const session of v.sessions as { deleted_at: string | null; venue_type: string | null; media: unknown }[]) {
          if (session.deleted_at) continue;
          const category = one<{ category: string }>(session.media)?.category ?? "Movie";
          counts.set(category, (counts.get(category) ?? 0) + 1);
          const type = effectiveVenueType(session.venue_type, v.type as string, category);
          typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
        }
        const kinds = [...counts.entries()].map(([category, count]) => ({ category, count }));
        const types = [...typeCounts.entries()].map(([category, count]) => ({ category, count }));
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
          types,
        }];
      }),
    );
  },

  async searchVenues(query) {
    const q = query.trim();
    if (q.length < 2) return ok([]);
    const db = getSupabase();
    const pattern = `%${literal(q)}%`;
    // Typing the start of "home" also brings every home forward, whatever name it was saved under.
    const homes = "home".startsWith(q.toLowerCase()) ? ",type.eq.home" : "";
    const { data, error } = await db
      .from("venues")
      .select("id, name, address, type")
      .or(`name.ilike.${pattern},address.ilike.${pattern},city.ilike.${pattern}${homes}`)
      .limit(60);
    if (error) return fail("Could not search your venues.");
    return rankVenues(db, data as VenueRow[]);
  },

  async recentVenues() {
    const db = getSupabase();
    const { data, error } = await db.from("venues").select("id, name, address, type").limit(200);
    if (error) return fail("Could not load your venues.");
    return rankVenues(db, data as VenueRow[]);
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
