// lib/adapters/supabase/SupabaseLogRepository.ts
// Writes a viewing across media_items, venues, watch_sessions, images and Storage.
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEntrySchema, type LogEntry } from "@/lib/domain/entry";
import type { CatalogMatch } from "@/lib/ports/catalog";
import type { DeletedEntry, LogRepository, OwnHit, RecentEntry, TitleDetail, ViewingSummary } from "@/lib/ports/log";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";

const BUCKET = "media";

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

async function findOrCreateVenue(db: SupabaseClient, entry: LogEntry): Promise<Result<string | null>> {
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

    // Upload the stubs; if anything goes wrong, undo the viewing and the files already sent.
    const uploaded: string[] = [];
    try {
      for (const [index, blob] of stubs.entries()) {
        const path = `${userId}/tickets/${sessionId}/${crypto.randomUUID()}.${EXTENSION[blob.type] ?? "bin"}`;
        const up = await db.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
        if (up.error) throw new Error("upload");
        uploaded.push(path);

        const row = await db
          .from("images")
          .insert({ kind: "ticket", source: "upload", path, session_id: sessionId, is_default: index === 0 });
        if (row.error) throw new Error("record");
      }
    } catch {
      if (uploaded.length > 0) await db.storage.from(BUCKET).remove(uploaded);
      await db.from("watch_sessions").delete().eq("id", sessionId);
      return fail("Could not upload the ticket images. Nothing was saved.");
    }

    return ok({ sessionId });
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
      .select("id, watched_on, watched_at, auditorium, primary_format, seats, total_tickets, rating, notes, venue:venues(name)")
      .eq("media_id", mediaId)
      .is("deleted_at", null)
      .order("watched_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (sessions.error) return fail("Could not load your viewings.");

    const ids = sessions.data.map((row) => row.id as string);
    const stubsBySession = new Map<string, string[]>();
    if (ids.length > 0) {
      const rows = await db
        .from("images").select("session_id, path").eq("kind", "ticket").in("session_id", ids)
        .order("is_default", { ascending: false });
      const paths = (rows.data ?? []).map((row) => row.path as string);
      const signed = paths.length > 0 ? await db.storage.from(BUCKET).createSignedUrls(paths, 3600) : null;
      const urlByPath = new Map((signed?.data ?? []).map((item) => [item.path, item.signedUrl]));
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

    const venue = await findOrCreateVenue(db, parsed.data);
    if (!venue.ok) return venue;
    const { error } = await db
      .from("watch_sessions")
      .update({ venue_id: venue.value, ...sessionColumns(parsed.data) })
      .eq("id", id);
    return error ? fail("Could not save your changes.") : ok(undefined);
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
};
