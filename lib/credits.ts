// lib/credits.ts
// Keeps saved genres and credits up to date: fills them in for new titles and refreshes old ones.
import { addPerformer, addStarring, saveCredits } from "@/lib/adapters/supabase/credits";
import { getSupabase } from "@/lib/adapters/supabase/client";
import { services } from "@/lib/services";

const STALE_DAYS = 30;
/** How many titles one backfill pass handles, so opening the app never fires hundreds of requests. */
const BATCH = 8;

/** Saves the credits of one catalogue title. */
export async function syncCredits(mediaId: string, kind: "Movie" | "TV Show", tmdbId: number): Promise<void> {
  const details = await services.catalog.details({ kind, tmdbId });
  if (details.ok) await saveCredits(mediaId, details.value);
}

/** Fills in titles that have no credits yet or have not been refreshed in a month. Quiet on failure. */
export async function backfillCredits(): Promise<void> {
  const db = getSupabase();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("media_items")
    .select("id, category, tmdb_id, last_synced_at, genres:media_genres(genre_id)")
    .in("category", ["Movie", "TV Show"])
    .not("tmdb_id", "is", null)
    .limit(400);
  const due = (data ?? [])
    .filter((row) => (row.genres as unknown[]).length === 0 || !row.last_synced_at || row.last_synced_at < cutoff)
    .slice(0, BATCH);
  for (const row of due) await syncCredits(row.id as string, row.category as "Movie" | "TV Show", row.tmdb_id as number);
}

export { addPerformer, addStarring };
