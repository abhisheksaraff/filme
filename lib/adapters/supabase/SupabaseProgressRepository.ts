// lib/adapters/supabase/SupabaseProgressRepository.ts
// Aired episodes per season saved for each show, refreshed only when a new episode is due.
import { edgeCatalog } from "@/lib/adapters/tmdb/EdgeCatalog";
import { normalize } from "@/lib/domain/search";
import { airedTotal, type SeasonCount } from "@/lib/domain/tv";
import type { ProgressRepository, ShowRef } from "@/lib/ports/progress";
import { showKey } from "@/lib/ports/progress";
import { getSupabase } from "./client";

const DAY_MS = 86_400_000;
/** Shows looked up from TMDB in one call; the rest are picked up the next time. */
const MAX_REFRESH = 8;

interface Saved {
  tmdb_id: number;
  title_key: string;
  aired_episodes: number;
  /** Aired episodes of each season, specials included; null on rows saved before seasons were kept. */
  aired_by_season: SeasonCount[] | null;
  next_air_date: string | null;
  running: boolean;
  checked_at: string;
}

/** True when a new episode has come due since the last look, or an undated running show has gone a week unchecked. */
function stale(row: Saved): boolean {
  // A show saved before seasons were kept is asked about once more, running or not.
  if (!row.aired_by_season) return true;
  if (!row.running) return false;
  const age = Date.now() - Date.parse(row.checked_at);
  const today = new Date().toISOString().slice(0, 10);
  if (row.next_air_date) return row.next_air_date <= today && age > DAY_MS;
  return age > 7 * DAY_MS;
}

export const supabaseProgressRepository: ProgressRepository = {
  async airedSeasons(shows) {
    const db = getSupabase();
    const out = new Map<string, SeasonCount[]>();
    if (shows.length === 0) return out;
    const keys = [...new Set(shows.map((s) => showKey(s.title, s.year, normalize)))];
    const ids = [...new Set(shows.flatMap((s) => (s.tmdbId ? [s.tmdbId] : [])))];

    const [byKey, byId] = await Promise.all([
      db.from("show_progress").select("tmdb_id, title_key, aired_episodes, aired_by_season, next_air_date, running, checked_at").in("title_key", keys),
      ids.length ? db.from("show_progress").select("tmdb_id, title_key, aired_episodes, aired_by_season, next_air_date, running, checked_at").in("tmdb_id", ids) : Promise.resolve({ data: [] as Saved[] }),
    ]);
    const saved = new Map<number, Saved>();
    for (const row of [...((byKey.data as Saved[] | null) ?? []), ...((byId.data as Saved[] | null) ?? [])]) saved.set(row.tmdb_id, row);
    const byTitle = new Map([...saved.values()].map((r) => [r.title_key, r]));

    const todo: { show: ShowRef; key: string }[] = [];
    for (const show of shows) {
      const key = showKey(show.title, show.year, normalize);
      const row = (show.tmdbId ? saved.get(show.tmdbId) : undefined) ?? byTitle.get(key);
      if (row?.aired_by_season) out.set(key, row.aired_by_season);
      if (!row || stale(row)) todo.push({ show, key });
    }

    // Looked up a few at a time; what is not reached now is reached next time.
    const queue = todo.filter((t, i) => todo.findIndex((o) => o.key === t.key) === i).slice(0, MAX_REFRESH);
    await Promise.all(queue.map(async ({ show, key }) => {
      let tmdbId = show.tmdbId ?? null;
      if (!tmdbId) {
        const hits = await edgeCatalog.search(show.title, "TV Show", 5);
        const hit = hits.ok ? (hits.value.find((h) => !show.year || h.year === show.year) ?? hits.value[0]) : undefined;
        tmdbId = hit?.tmdbId ?? null;
      }
      if (!tmdbId) return;
      const status = await edgeCatalog.showStatus(tmdbId);
      if (!status.ok) return;
      // Only what has aired counts, so a show that is up to date reads as finished: the season on air stops at its latest
      // episode and later seasons are left out. The specials (season 0) come first and count as aired.
      const last = status.value.last;
      const seasons: SeasonCount[] = [
        ...(status.value.specials ? [{ season: 0, episodes: status.value.specials }] : []),
        ...status.value.seasons.flatMap((s) => {
          if (!last) return [{ season: s.season, episodes: s.episodes }];
          if (s.season > last.season) return [];
          return [{ season: s.season, episodes: s.season === last.season ? Math.min(s.episodes, last.episode) : s.episodes }];
        }),
      ];
      const total = airedTotal(seasons);
      const next = status.value.next?.airDate?.slice(0, 10) ?? null;
      await db.from("show_progress").upsert({ tmdb_id: tmdbId, title_key: key, aired_episodes: total, aired_by_season: seasons, next_air_date: next, running: status.value.running, checked_at: new Date().toISOString() }, { onConflict: "user_id,tmdb_id" });
      if (total > 0) out.set(key, seasons);
    }));
    return out;
  },
};
