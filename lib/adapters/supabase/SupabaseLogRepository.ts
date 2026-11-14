// lib/adapters/supabase/SupabaseLogRepository.ts
// Writes a viewing across media_items, venues, watch_sessions, images and Storage.
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEntrySchema, type LogEntry } from "@/lib/domain/entry";
import type { LogRepository, RecentEntry } from "@/lib/ports/log";
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

async function findOrCreateMedia(db: SupabaseClient, entry: LogEntry): Promise<Result<string>> {
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
      .insert({
        media_id: media.value,
        venue_id: venue.value,
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
      })
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
      .select("id, watched_on, primary_format, created_at, media:media_items(title, category, poster_path)")
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
        title: media?.title ?? "Untitled",
        category: media?.category ?? "Movie",
        posterPath: media?.poster_path ?? null,
        watchedOn: row.watched_on,
        primaryFormat: row.primary_format,
      };
    });
    return ok(rows);
  },
};
