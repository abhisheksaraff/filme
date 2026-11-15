// lib/adapters/supabase/SupabaseLogRepository.ts
// Writes a viewing across media_items, venues, watch_sessions, images and Storage.
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEntrySchema, type LogEntry } from "@/lib/domain/entry";
import type { StatRow } from "@/lib/domain/stats";
import type { CatalogMatch } from "@/lib/ports/catalog";
import type { DeletedEntry, LogRepository, OwnHit, RecentEntry, TitleDetail, ViewingSummary } from "@/lib/ports/log";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { putWithFallback, storeFor } from "@/lib/files";
import { lastHomeVenue } from "./venues";


const VENUE_TYPE: Record<LogEntry["category"], string> = {
  Movie: "cinema",
  "TV Show": "home",
  Concert: "arena",
  "Live Event": "theatre",
};

/** Escapes % and _ so a venue name is matched literally by ILIKE. */
const literal = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const EXTENSION: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Finds a title by its catalogue id, or saves it. Shared with the want-to-watch list. */
export async function findOrCreateMedia(
  db: SupabaseClient,
  entry: Pick<LogEntry, "category" | "title" | "media">,
): Promise<Result<string>> {
  const media = entry.media;
  if (media) {
    const found = await db
      .from("media_items").select("id").eq("category", entry.category).eq("tmdb_id", media.tmdbId).maybeSingle();
    if (found.error) return fail("Could not look up the title.");
    if (found.data) return ok(found.data.id as string);
  }

  const inserted = await db
    .from("media_items")
    .insert({
      source: media ? "tmdb" : "custom",
      tmdb_id: media?.tmdbId ?? null,
      imdb_id: media?.imdbId ?? null,
      category: entry.category,
      title: media?.title ?? entry.title,
      original_title: media?.originalTitle ?? null,
      original_language: media?.originalLanguage ?? null,
      release_date: media?.releaseDate ?? null,
      runtime: media?.runtime ?? null,
      overview: media?.overview ?? null,
      vote_average: media?.voteAverage ?? null,
      vote_count: media?.voteCount ?? null,
      poster_path: media?.posterPath ?? null,
      backdrop_path: media?.backdropPath ?? null,
      last_synced_at: media ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (inserted.error) return fail("Could not save the title.");
  return ok(inserted.data.id as string);
}

/**
 * "Home" in the screen field marks a viewing at home. With an address it uses (or creates) the home
 * at that address, which then becomes the current home; without one it reuses the last home.
 */
async function findOrCreateHome(db: SupabaseClient, entry: LogEntry): Promise<Result<string | null>> {
  const address = entry.address?.trim() || null;
  if (address) {
    const found = await db.from("venues").select("id").eq("type", "home").ilike("address", literal(address)).limit(1).maybeSingle();
    if (found.error) return fail("Could not look up your home.");
    if (found.data) return ok(found.data.id as string);
  } else {
    const last = await lastHomeVenue(db);
    if (last) return ok(last.id);
  }
  const inserted = await db.from("venues").insert({ name: entry.location?.trim() || "Home", type: "home", address }).select("id").single();
  return inserted.error ? fail("Could not save your home.") : ok(inserted.data.id as string);
}

async function findOrCreateVenue(db: SupabaseClient, entry: LogEntry): Promise<Result<string | null>> {
  if (entry.auditorium?.trim().toLowerCase() === "home") return findOrCreateHome(db, entry);
  if (!entry.location) return ok(null);
  const found = await db.from("venues").select("id").ilike("name", literal(entry.location)).limit(1).maybeSingle();
  if (found.error) return fail("Could not look up the venue.");
  if (found.data) return ok(found.data.id as string);

  const inserted = await db
    .from("venues")
    .insert({ name: entry.location, type: VENUE_TYPE[entry.category], address: entry.address })
    .select("id")
    .single();
  if (inserted.error) return fail("Could not save the venue.");
  return ok(inserted.data.id as string);
}

/** YYYY, YYYY-MM or YYYY-MM-DD, with how precise it is. */
function datePrecision(date: string | null): "day" | "month" | "year" | "unknown" {
  if (!date) return "unknown";
  return date.length === 10 ? "day" : date.length === 7 ? "month" : "year";
}

/** The watch_sessions columns that come from the form, shared by saving and editing. */
function sessionColumns(entry: LogEntry) {
  return {
    scope: scopeOf(entry),
    season_number: entry.category === "TV Show" ? entry.season : null,
    episode_number: entry.category === "TV Show" ? entry.episode : null,
    watched_on: entry.date,
    date_precision: datePrecision(entry.date),
    watched_at: entry.time,
    rating: entry.rating,
    notes: entry.notes,
    primary_format: entry.primaryFormat,
    addons: entry.addons,
    auditorium: entry.auditorium,
    seats: entry.seats,
    total_tickets: entry.totalTickets,
  };
}

/** Joined rows can arrive as an object or a one-item list depending on the relationship. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface MediaRef {
  category: string;
  tmdb_id: number | null;
}

/** Distinct catalogue titles from joined rows, in order, keeping only ones TMDB knows. */
function matchesFrom(rows: { media: unknown }[], limit: number): CatalogMatch[] {
  const seen = new Set<string>();
  const out: CatalogMatch[] = [];
  for (const row of rows) {
    const media = one(row.media as MediaRef | MediaRef[] | null);
    if (!media || media.tmdb_id === null) continue;
    if (media.category !== "Movie" && media.category !== "TV Show") continue;
    const key = `${media.category}:${media.tmdb_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tmdbId: media.tmdb_id, kind: media.category });
    if (out.length >= limit) break;
  }
  return out;
}

function scopeOf(entry: LogEntry): "show" | "season" | "episode" {
  if (entry.category !== "TV Show") return "show";
  if (entry.episode !== null) return "episode";
  return entry.season !== null ? "season" : "show";
}

export const supabaseLogRepository: LogRepository = {
  async saveEntry(input, stubs) {
    // Validate again here: the form is not the only thing that could call this.
    const parsed = logEntrySchema.safeParse(input);
    if (!parsed.success) return fail("Some fields are not valid.");
    const entry = parsed.data;

    const db = getSupabase();
    const { data: auth } = await db.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return fail("Your session has expired. Sign in again.");

    const media = await findOrCreateMedia(db, entry);
    if (!media.ok) return media;
    const venue = await findOrCreateVenue(db, entry);
    if (!venue.ok) return venue;

    const session = await db
      .from("watch_sessions")
      .insert({ media_id: media.value, venue_id: venue.value, ...sessionColumns(entry) })
      .select("id")
      .single();
    if (session.error) return fail("Could not save the viewing.");
    const sessionId = session.data.id as string;

    // Watching a title takes it off the Watchlist; it is marked cleared (not deleted) so it can be counted.
    const cleared = await db
      .from("want_to_watch")
      .update({ cleared_at: new Date().toISOString() })
      .eq("media_id", media.value)
      .is("cleared_at", null)
      .select("id");
    const clearedWatchlist = !cleared.error && (cleared.data?.length ?? 0) > 0;

    // Upload the stubs; if anything goes wrong, undo the viewing and the files already sent.
    const uploaded: { path: string; store: string }[] = [];
    try {
      for (const [index, blob] of stubs.entries()) {
        const path = `${userId}/tickets/${sessionId}/${crypto.randomUUID()}.${EXTENSION[blob.type] ?? "bin"}`;
        const up = await putWithFallback(path, blob);
        if (!up.ok) throw new Error("upload");
        uploaded.push({ path, store: up.value.id });

        const row = await db
          .from("images")
          .insert({ kind: "ticket", source: "upload", path, store: up.value.id, session_id: sessionId, is_default: index === 0 });
        if (row.error) throw new Error("record");
      }
    } catch {
      for (const file of uploaded) await storeFor(file.store).remove([file.path]);
      await db.from("watch_sessions").delete().eq("id", sessionId);
      return fail("Could not upload the ticket images. Nothing was saved.");
    }

    return ok({ sessionId, mediaId: media.value, clearedWatchlist });
  },

  async recent(limit) {
    const { data, error } = await getSupabase()
      .from("watch_sessions")
      .select("id, media_id, watched_on, primary_format, created_at, media:media_items(title, category, poster_path)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail("Could not load your viewings.");

    const rows: RecentEntry[] = data.map((row) => {
      const media = (Array.isArray(row.media) ? row.media[0] : row.media) as
        | { title: string; category: string; poster_path: string | null }
        | null;
      return {
        id: row.id,
        mediaId: row.media_id as string,
        title: media?.title ?? "Untitled",
        category: media?.category ?? "Movie",
        posterPath: media?.poster_path ?? null,
        watchedOn: row.watched_on,
        primaryFormat: row.primary_format,
      };
    });
    return ok(rows);
  },

  async titleDetail(mediaId) {
    const db = getSupabase();
    const media = await db.from("media_items").select("*").eq("id", mediaId).maybeSingle();
    if (media.error || !media.data) return fail("Could not find that title.");

    const sessions = await db
      .from("watch_sessions")
      .select("id, watched_on, watched_at, auditorium, primary_format, seats, total_tickets, rating, notes, venue:venues(id, name)")
      .eq("media_id", mediaId)
      .is("deleted_at", null)
      .order("watched_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (sessions.error) return fail("Could not load your viewings.");

    const ids = sessions.data.map((row) => row.id as string);
    const stubsBySession = new Map<string, string[]>();
    if (ids.length > 0) {
      const rows = await db
        .from("images").select("session_id, path, store").eq("kind", "ticket").in("session_id", ids)
        .order("is_default", { ascending: false });
      // Each stub is linked from whichever store holds it.
      const urlByPath = new Map<string, string>();
      for (const store of new Set((rows.data ?? []).map((row) => row.store as string))) {
        const paths = (rows.data ?? []).filter((row) => row.store === store).map((row) => row.path as string);
        const res = await storeFor(store).urls(paths);
        if (res.ok) for (const [path, url] of res.value) urlByPath.set(path, url);
      }
      for (const row of rows.data ?? []) {
        const url = urlByPath.get(row.path as string);
        if (!url) continue;
        stubsBySession.set(row.session_id, [...(stubsBySession.get(row.session_id) ?? []), url]);
      }
    }

    const viewings: ViewingSummary[] = sessions.data.map((row) => ({
      id: row.id,
      watchedOn: row.watched_on,
      watchedAt: row.watched_at,
      venue: one<{ name: string }>(row.venue)?.name ?? null,
      venueId: one<{ id: string }>(row.venue)?.id ?? null,
      auditorium: row.auditorium,
      primaryFormat: row.primary_format,
      seats: row.seats ?? [],
      totalTickets: row.total_tickets,
      rating: row.rating === null ? null : Number(row.rating),
      notes: row.notes,
      stubUrls: stubsBySession.get(row.id) ?? [],
    }));

    const detail: TitleDetail = {
      mediaId,
      tmdbId: media.data.tmdb_id ?? null,
      title: media.data.title,
      category: media.data.category,
      overview: media.data.overview,
      releaseDate: media.data.release_date,
      runtime: media.data.runtime,
      posterPath: media.data.poster_path,
      backdropPath: media.data.backdrop_path,
      viewings,
    };
    return ok(detail);
  },

  async getViewing(id) {
    const { data, error } = await getSupabase()
      .from("watch_sessions")
      .select("media_id, scope, season_number, episode_number, watched_on, watched_at, rating, notes, primary_format, addons, auditorium, seats, total_tickets, media:media_items(*), venue:venues(name, address)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) return fail("Could not find that viewing.");

    const media = one<Record<string, unknown>>(data.media);
    const venue = one<{ name: string; address: string | null }>(data.venue);
    if (!media) return fail("Could not find that viewing's title.");

    const parsed = logEntrySchema.safeParse({
      category: media.category,
      title: media.title,
      season: data.season_number,
      episode: data.episode_number,
      episodeTitle: null,
      location: venue?.name ?? null,
      address: venue?.address ?? null,
      auditorium: data.auditorium,
      date: data.watched_on,
      time: data.watched_at,
      seats: data.seats ?? [],
      totalTickets: data.total_tickets,
      primaryFormat: data.primary_format ?? "Standard",
      addons: data.addons ?? [],
      rating: data.rating === null ? null : Number(data.rating),
      notes: data.notes,
      media:
        media.tmdb_id === null
          ? null
          : {
              tmdbId: media.tmdb_id,
              imdbId: media.imdb_id,
              title: media.title,
              originalTitle: media.original_title,
              originalLanguage: media.original_language,
              releaseDate: media.release_date,
              runtime: media.runtime,
              overview: media.overview,
              voteAverage: media.vote_average,
              voteCount: media.vote_count,
              posterPath: media.poster_path,
              backdropPath: media.backdrop_path,
            },
    });
    if (!parsed.success) return fail("This viewing has data the form cannot read.");
    return ok({ mediaId: data.media_id as string, entry: parsed.data });
  },

  async updateViewing(id, input) {
    const parsed = logEntrySchema.safeParse(input);
    if (!parsed.success) return fail("Some fields are not valid.");
    const db = getSupabase();

    // The title or type may have changed, so find (or create) the title again and point the viewing at it.
    const media = await findOrCreateMedia(db, parsed.data);
    if (!media.ok) return media;
    const venue = await findOrCreateVenue(db, parsed.data);
    if (!venue.ok) return venue;
    const { error } = await db
      .from("watch_sessions")
      .update({ media_id: media.value, venue_id: venue.value, ...sessionColumns(parsed.data) })
      .eq("id", id);
    return error ? fail("Could not save your changes.") : ok({ mediaId: media.value });
  },

  async purgeExpired() {
    const db = getSupabase();
    // A deleted viewing can be restored for 24 hours, then it is removed for good.
    const cutoff = new Date(Date.now() - 86_400_000).toISOString();
    const old = await db.from("watch_sessions").select("id").lt("deleted_at", cutoff).limit(100);
    if (old.error) return fail("Could not check deleted viewings.");
    if (old.data.length === 0) return ok(0);
    const ids = old.data.map((r) => r.id as string);

    // Files are removed first: once the rows are gone nothing would remember their paths.
    const files = await db.from("images").select("path, source, store").in("session_id", ids);
    for (const store of new Set((files.data ?? []).map((f) => f.store as string))) {
      const paths = (files.data ?? []).filter((f) => f.source === "upload" && f.store === store).map((f) => f.path as string);
      if (paths.length > 0) await storeFor(store).remove(paths);
    }
    const del = await db.from("watch_sessions").delete().in("id", ids);
    return del.error ? fail("Could not remove old deleted viewings.") : ok(ids.length);
  },

  async deleteViewing(id) {
    const { error } = await getSupabase().from("watch_sessions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    return error ? fail("Could not delete the viewing.") : ok(undefined);
  },

  async restoreViewing(id) {
    const { error } = await getSupabase().from("watch_sessions").update({ deleted_at: null }).eq("id", id);
    return error ? fail("Could not restore the viewing.") : ok(undefined);
  },

  async deleted(limit) {
    const { data, error } = await getSupabase()
      .from("watch_sessions")
      .select("id, deleted_at, media:media_items(title)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(limit);
    if (error) return fail("Could not load deleted viewings.");
    const rows: DeletedEntry[] = data.map((row) => ({
      id: row.id,
      title: one<{ title: string }>(row.media)?.title ?? "Untitled",
      deletedAt: row.deleted_at as string,
    }));
    return ok(rows);
  },

  async search(query, limit) {
    const q = query.trim();
    if (q.length < 2) return ok([]);
    const { data, error } = await getSupabase()
      .from("media_items")
      .select("id, title, category, release_date, poster_path, watch_sessions!inner(id)")
      .ilike("title", `%${literal(q)}%`)
      .is("watch_sessions.deleted_at", null)
      .limit(limit);
    if (error) return fail("Could not search your log.");

    const hits: OwnHit[] = data.map((row) => ({
      mediaId: row.id,
      title: row.title,
      category: row.category,
      year: row.release_date ? String(row.release_date).slice(0, 4) : null,
      posterPath: row.poster_path,
      viewings: Array.isArray(row.watch_sessions) ? row.watch_sessions.length : 1,
    }));
    return ok(hits);
  },

  async favourites(limit) {
    const db = getSupabase();
    const rated = await db
      .from("watch_sessions")
      .select("media:media_items(category, tmdb_id)")
      .is("deleted_at", null)
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .order("watched_on", { ascending: false, nullsFirst: false })
      .limit(60);
    if (rated.error) return fail("Could not load your favourites.");

    const picks = matchesFrom(rated.data, limit);
    if (picks.length >= limit) return ok(picks);

    // Not enough rated titles yet: fill up with the most recent ones.
    const recent = await db
      .from("watch_sessions")
      .select("media:media_items(category, tmdb_id)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (recent.error) return fail("Could not load your favourites.");
    return ok(matchesFrom([...rated.data, ...recent.data], limit));
  },

  async seen() {
    const { data, error } = await getSupabase()
      .from("watch_sessions")
      .select("media:media_items(category, tmdb_id)")
      .is("deleted_at", null)
      .limit(1000);
    if (error) return fail("Could not load what you have seen.");
    return ok(matchesFrom(data, 1000).map((m) => `${m.kind}:${m.tmdbId}`));
  },

  async statRows() {
    const db = getSupabase();
    const rows: StatRow[] = [];
    const PAGE = 1000;
    // Supabase returns at most 1000 rows per request, so read the log in pages.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("watch_sessions")
        .select(
          "id, media_id, watched_on, primary_format, rating, total_tickets, notes, scope, season_number, episode_number, media:media_items(title, category, runtime, original_language, poster_path, release_date), venue:venues(name)",
        )
        .is("deleted_at", null)
        .order("created_at")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return fail("Could not load your statistics.");

      for (const row of data) {
        const media = one<{ title: string; category: string; runtime: number | null; original_language: string | null; poster_path: string | null; release_date: string | null }>(row.media);
        rows.push({
          id: row.id as string,
          mediaId: row.media_id as string,
          title: media?.title ?? "Untitled",
          category: media?.category ?? "Movie",
          posterPath: media?.poster_path ?? null,
          watchedOn: row.watched_on,
          runtime: media?.runtime ?? null,
          releaseYear: media?.release_date ? Number(String(media.release_date).slice(0, 4)) || null : null,
          venue: one<{ name: string }>(row.venue)?.name ?? null,
          format: row.primary_format,
          rating: row.rating === null ? null : Number(row.rating),
          tickets: row.total_tickets,
          language: media?.original_language ?? null,
          notes: row.notes ?? null,
          scope: row.scope as string,
          season: row.season_number ?? null,
          episode: row.episode_number ?? null,
          genres: [],
          directors: [],
          actors: [],
          performers: [],
        });
      }
      if (data.length < PAGE) break;
    }

    // Genres and people live in their own tables; attach them to each viewing by title.
    const mediaIds = [...new Set(rows.map((r) => r.mediaId))];
    const genres = new Map<string, string[]>();
    const people = new Map<string, { role: string; name: string }[]>();
    for (let i = 0; i < mediaIds.length; i += 200) {
      const chunk = mediaIds.slice(i, i + 200);
      const [g, p] = await Promise.all([
        db.from("media_genres").select("media_id, genre:genres(name)").in("media_id", chunk),
        db.from("media_people").select("media_id, role, billing_order, person:people(name)").in("media_id", chunk),
      ]);
      for (const row of g.data ?? []) {
        const name = one<{ name: string }>(row.genre)?.name;
        if (name) genres.set(row.media_id, [...(genres.get(row.media_id) ?? []), name]);
      }
      for (const row of p.data ?? []) {
        const name = one<{ name: string }>(row.person)?.name;
        // Only the top-billed cast count as "actors" so extras do not swamp the numbers.
        if (!name || (row.role === "actor" && (row.billing_order ?? 0) > 9)) continue;
        people.set(row.media_id, [...(people.get(row.media_id) ?? []), { role: row.role as string, name }]);
      }
    }
    for (const row of rows) {
      row.genres = genres.get(row.mediaId) ?? [];
      const credits = people.get(row.mediaId) ?? [];
      row.directors = credits.filter((c) => c.role === "director").map((c) => c.name);
      row.actors = credits.filter((c) => c.role === "actor").map((c) => c.name);
      row.performers = credits.filter((c) => c.role === "performer" || c.role === "opener").map((c) => c.name);
    }
    return ok(rows);
  },
};
