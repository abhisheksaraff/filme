// lib/adapters/supabase/SupabaseRatingsRepository.ts
// IMDb ids and ratings for the title pages: saved on the title, refreshed from OMDb at most weekly.
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import { ok } from "@/lib/ports/result";
import { scoreKey, type RatingsRepository, type ScoreItem } from "@/lib/ports/ratings";
import { callFunction } from "./functions";
import { getSupabase } from "./client";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;
/** A score looked up for the lists is kept this long before IMDb is asked again. */
const LIST_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const AT_ONCE = 2;

/** Titles already asked about in this visit, so a list that redraws never asks twice. */
const asked = new Set<string>();
/** Set when OMDb refuses (no key, daily limit): nothing more is asked until this time, and the catalogue score is shown. */
let omdbPausedUntil = 0;

interface Known {
  /** For a saved title: the catalogue id it was saved with, so it can be looked up without the caller knowing it. */
  tmdbId?: number | null;
  imdbId: string | null;
  imdb: number | null;
  tmdb: number | null;
  checkedAt: string | null;
}

/** IMDb is asked again when never asked, a month old, or (for a film out in the last year with no score yet) a day old. */
function wantsLookup(known: Known | undefined, releaseDate: string | null | undefined): boolean {
  if (!known || known.checkedAt === null) return true;
  const age = Date.now() - Date.parse(known.checkedAt);
  const recent = releaseDate ? Date.now() - Date.parse(releaseDate) < 365 * DAY_MS : false;
  return age > (recent && known.imdb === null ? DAY_MS : LIST_STALE_MS);
}
export const supabaseRatingsRepository: RatingsRepository = {
  async scores(items, opts) {
    const db = getSupabase();
    const out = new Map<string, number>();
    const known = new Map<string, Known>();
    const keyOf = scoreKey;

    // Saved titles keep their score on the title; everything else is in the scores table.
    const mediaIds = [...new Set(items.flatMap((i) => (i.mediaId ? [i.mediaId] : [])))];
    const loose = items.filter((i) => !i.mediaId && i.tmdbId !== null);
    const [media, saved] = await Promise.all([
      mediaIds.length ? db.from("media_items").select("id, tmdb_id, imdb_id, imdb_rating, imdb_rating_at, vote_average").in("id", mediaIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      loose.length ? db.from("title_scores").select("category, tmdb_id, imdb_id, imdb_rating, tmdb_rating, imdb_checked_at").in("tmdb_id", [...new Set(loose.map((i) => i.tmdbId as number))]) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);
    for (const r of media.data ?? []) {
      known.set(r.id as string, { tmdbId: r.tmdb_id as number | null, imdbId: r.imdb_id as string | null, imdb: r.imdb_rating === null ? null : Number(r.imdb_rating), tmdb: r.vote_average === null ? null : Number(r.vote_average), checkedAt: r.imdb_rating_at as string | null });
    }
    for (const r of saved.data ?? []) {
      const kind = r.category === "TV Show" ? "TV Show" : "Movie";
      known.set(`${kind}:${r.tmdb_id}`, { imdbId: r.imdb_id as string | null, imdb: r.imdb_rating === null ? null : Number(r.imdb_rating), tmdb: r.tmdb_rating === null ? null : Number(r.tmdb_rating), checkedAt: r.imdb_checked_at as string | null });
    }

    const best = (item: ScoreItem): number | null => {
      const k = known.get(keyOf(item));
      const value = k?.imdb ?? k?.tmdb ?? item.tmdbRating ?? null;
      return value !== null && value > 0 ? Math.round(value * 10) / 10 : null;
    };
    for (const item of items) {
      const v = best(item);
      if (v !== null) out.set(keyOf(item), v);
    }

    // The rest are looked up in the background, a couple at a time, and only up to the caller's limit.
    const queue = items
      .map((i) => ({ ...i, tmdbId: i.tmdbId ?? known.get(keyOf(i))?.tmdbId ?? null }))
      .filter((i) => i.tmdbId !== null && wantsLookup(known.get(keyOf(i)), i.releaseDate) && !asked.has(keyOf(i)))
      .slice(0, opts?.fill ?? 0);
    for (const item of queue) asked.add(keyOf(item));
    void (async () => {
      const work = [...queue];
      const worker = async () => {
        for (let item = work.shift(); item; item = work.shift()) {
          if (Date.now() < omdbPausedUntil) return;
          const k = known.get(keyOf(item));
          let imdbId = k?.imdbId ?? null;
          let tmdb = k?.tmdb ?? item.tmdbRating ?? null;
          let releasedAt: string | null = item.releaseDate ?? null;
          if (!imdbId && item.tmdbId !== null) {
            const details = await edgeCatalog.details({ kind: item.kind, tmdbId: item.tmdbId });
            if (details.ok) {
              imdbId = details.value.imdbId;
              tmdb = tmdb ?? details.value.voteAverage;
              releasedAt = releasedAt ?? details.value.releaseDate ?? null;
            }
          }
          let imdb: number | null = null;
          if (imdbId) {
            const res = await callFunction<{ rating: number | null }>("omdb", { imdbId });
            // Both keys used up, no key, or OMDb down: nothing is saved, the catalogue score stands, and OMDb is left alone a while.
            if (!res.ok) {
              omdbPausedUntil = Date.now() + 10 * 60_000;
              asked.delete(keyOf(item));
              if (tmdb !== null && tmdb > 0 && !out.has(keyOf(item))) opts?.onScore?.(keyOf(item), Math.round(tmdb * 10) / 10);
              continue;
            }
            imdb = res.value.rating;
          }
          const now = new Date().toISOString();
          if (item.mediaId) await db.from("media_items").update({ imdb_id: imdbId, imdb_rating: imdb, imdb_rating_at: now }).eq("id", item.mediaId);
          else if (item.tmdbId !== null) {
            await db.from("title_scores").upsert({ category: item.kind, tmdb_id: item.tmdbId, imdb_id: imdbId, imdb_rating: imdb, tmdb_rating: tmdb, released_at: releasedAt && /^\d{4}-\d{2}-\d{2}/.test(releasedAt) ? releasedAt.slice(0, 10) : null, imdb_checked_at: now }, { onConflict: "user_id,category,tmdb_id" });
          }
          const score = imdb ?? tmdb;
          if (score !== null && score > 0) opts?.onScore?.(keyOf(item), Math.round(score * 10) / 10);
        }
      };
      await Promise.all(Array.from({ length: AT_ONCE }, worker));
    })();
    return out;
  },

  async forTitle({ mediaId, kind, tmdbId, known }) {
    const db = getSupabase();
    let imdbId = known?.imdbId ?? null;
    let tmdbRating = known?.tmdbRating ?? null;
    let imdbRating: number | null = null;
    let checkedAt: string | null = null;
    let releasedAt: string | null = null;

    if (mediaId) {
      const row = await db.from("media_items").select("imdb_id, imdb_rating, imdb_rating_at, vote_average, release_date").eq("id", mediaId).maybeSingle();
      if (row.data) {
        imdbId = imdbId ?? (row.data.imdb_id as string | null);
        imdbRating = row.data.imdb_rating === null ? null : Number(row.data.imdb_rating);
        checkedAt = row.data.imdb_rating_at as string | null;
        releasedAt = row.data.release_date as string | null;
        tmdbRating = tmdbRating ?? (row.data.vote_average === null ? null : Number(row.data.vote_average));
      }
    }

    // Shows saved before this existed have no IMDb id; ask the catalogue once and keep the answer.
    if (!imdbId && tmdbId !== null) {
      const details = await edgeCatalog.details({ kind, tmdbId });
      if (details.ok) {
        imdbId = details.value.imdbId;
        tmdbRating = tmdbRating ?? details.value.voteAverage;
        if (mediaId && imdbId) await db.from("media_items").update({ imdb_id: imdbId }).eq("id", mediaId);
      }
    }

    // A title out within the last year with no IMDb score yet is looked at again daily; ratings appear a few weeks after release.
    const recent = releasedAt !== null && Date.now() - Date.parse(releasedAt) < 365 * 86_400_000;
    const limit = recent && imdbRating === null ? 86_400_000 : STALE_MS;
    const fresh = checkedAt !== null && Date.now() - Date.parse(checkedAt) < limit;
    if (imdbId && !fresh) {
      const res = await callFunction<{ rating: number | null }>("omdb", { imdbId });
      // Without a key (or when OMDb is down) the TMDB rating is shown instead, and nothing is saved.
      if (res.ok) {
        imdbRating = res.value.rating;
        if (mediaId) await db.from("media_items").update({ imdb_rating: imdbRating, imdb_rating_at: new Date().toISOString() }).eq("id", mediaId);
      }
    }
    return ok({ imdbId, imdbRating, tmdbRating });
  },
};
