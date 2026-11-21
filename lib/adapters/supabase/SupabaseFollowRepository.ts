// lib/adapters/supabase/SupabaseFollowRepository.ts
// Which shows the user follows for new episodes, and the latest aired episode the daily check found for each.
import type { Cover } from "@/lib/domain/tv";
import type { FollowRepository, TrackedShow } from "@/lib/ports/follows";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

interface MediaRow {
  id?: string;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
}

const one = <T>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] : value) ?? null;

export const supabaseFollowRepository: FollowRepository = {
  async mode(mediaId) {
    const { data, error } = await getSupabase().from("show_follows").select("mode").eq("media_id", mediaId).maybeSingle();
    if (error) return fail("Could not check whether you follow this show.");
    return ok((data?.mode as "on" | "off" | null | undefined) ?? null);
  },

  async set(mediaId, mode) {
    const { error } = await getSupabase().from("show_follows").upsert({ media_id: mediaId, mode }, { onConflict: "user_id,media_id" });
    return error ? fail("Could not save that.") : ok(undefined);
  },

  async tracked() {
    const db = getSupabase();
    const [sessions, follows] = await Promise.all([
      db
        .from("watch_sessions")
        .select("media_id, scope, season_number, episode_number, watched_on, created_at, media_items!inner(title, category, tmdb_id, poster_path)")
        .eq("media_items.category", "TV Show")
        .is("deleted_at", null)
        .limit(3000),
      db.from("show_follows").select("media_id, mode, running, aired_season, aired_episode, aired_on, aired_name, checked_on, continue_removed_after, media:media_items(title, tmdb_id, poster_path)"),
    ]);
    if (sessions.error || follows.error) return fail("Could not load your shows.");

    const cutoff = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const byId = new Map<string, TrackedShow>();
    const get = (mediaId: string, media: MediaRow | null): TrackedShow | null => {
      const found = byId.get(mediaId);
      if (found) return found;
      if (!media || media.tmdb_id === null) return null;
      const show: TrackedShow = { mediaId, tmdbId: media.tmdb_id, title: media.title, posterPath: media.poster_path, mode: null, running: null, aired: null, checkedOn: null, recent: false, covers: [], latest: null, removedAfter: null };
      byId.set(mediaId, show);
      return show;
    };

    for (const row of sessions.data) {
      const show = get(row.media_id as string, one<MediaRow>(row.media_items as MediaRow | MediaRow[] | null));
      if (!show) continue;
      const cover: Cover = { scope: row.scope as Cover["scope"], season: row.season_number ?? null, episode: row.episode_number ?? null, date: row.watched_on ?? null };
      show.covers.push(cover);
      // Where you are comes from the viewing added last, whatever day it was for.
      const addedAt = row.created_at as string;
      if (!show.latest || Date.parse(addedAt) >= Date.parse(show.latest.addedAt)) show.latest = { scope: cover.scope, season: cover.season, episode: cover.episode, addedAt };
      if (cover.date && cover.date >= cutoff.slice(0, cover.date.length)) show.recent = true;
    }
    for (const row of follows.data) {
      const show = get(row.media_id as string, one<MediaRow>(row.media as MediaRow | MediaRow[] | null));
      if (!show) continue;
      show.mode = (row.mode as "on" | "off" | null) ?? null;
      show.running = (row.running as boolean | null) ?? null;
      show.checkedOn = (row.checked_on as string | null) ?? null;
      show.removedAfter = (row.continue_removed_after as string | null) ?? null;
      if (row.aired_season !== null && row.aired_episode !== null) {
        show.aired = { season: row.aired_season as number, episode: row.aired_episode as number, airDate: (row.aired_on as string | null) ?? null, name: (row.aired_name as string | null) ?? null };
      }
    }
    return ok([...byId.values()]);
  },

  async removeFromContinue(mediaId, latestAddedAt) {
    const { error } = await getSupabase().from("show_follows").upsert({ media_id: mediaId, continue_removed_after: latestAddedAt }, { onConflict: "user_id,media_id" });
    return error ? fail("Could not remove it from Home.") : ok(undefined);
  },

  async saveCheck(mediaId, check) {
    const { error } = await getSupabase().from("show_follows").upsert(
      {
        media_id: mediaId,
        running: check.running,
        aired_season: check.aired?.season ?? null,
        aired_episode: check.aired?.episode ?? null,
        aired_on: check.aired?.airDate ?? null,
        aired_name: check.aired?.name ?? null,
        checked_on: check.checkedOn,
      },
      { onConflict: "user_id,media_id" },
    );
    return error ? fail("Could not save the check.") : ok(undefined);
  },
};
