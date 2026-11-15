// lib/adapters/supabase/SupabaseRatingsRepository.ts
// IMDb ids and ratings for the title pages: saved on the title, refreshed from OMDb at most weekly.
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import { ok } from "@/lib/ports/result";
import type { RatingsRepository } from "@/lib/ports/ratings";
import { callFunction } from "./functions";
import { getSupabase } from "./client";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export const supabaseRatingsRepository: RatingsRepository = {
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
