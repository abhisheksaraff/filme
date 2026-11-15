// lib/logShow.ts
// Logging TV: one viewing for a whole series, a season or an episode, with the episodes and minutes it covers worked out.
import { mediaFromCatalog } from "@/components/entryDraft";
import { logEntrySchema, type LogEntry } from "@/lib/domain/entry";
import { syncCredits } from "@/lib/credits";
import type { CatalogDetails, EpisodeDetail, SeasonDetail, ShowStatus } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";
import { toast } from "@/lib/toast";

const today = () => new Date().toISOString().slice(0, 10);

/** What a viewing covers, for statistics. */
export interface Coverage {
  episodes: number;
  seasons: number;
  minutes: number;
}

/** A show's status with every season that has regular episodes, fetched together. */
export interface ShowData {
  status: ShowStatus;
  seasons: SeasonDetail[];
}

export async function loadSeasons(tmdbId: number): Promise<Result<ShowData>> {
  const status = await services.catalog.showStatus(tmdbId);
  if (!status.ok) return fail(status.error);
  const seasons = await Promise.all(status.value.seasons.map((s) => services.catalog.season(tmdbId, s.season)));
  const failed = seasons.find((s) => !s.ok);
  if (failed && !failed.ok) return fail(failed.error);
  return ok({ status: status.value, seasons: seasons.flatMap((s) => (s.ok ? [s.value] : [])) });
}

/** Episodes that have aired by `date` (all of them when it is null), with a fallback runtime for those without one. */
function counted(episodes: readonly EpisodeDetail[], date: string | null, fallback: number): { episodes: number; minutes: number } {
  const aired = episodes.filter((e) => !e.airDate || !date || e.airDate <= date);
  return { episodes: aired.length, minutes: aired.reduce((sum, e) => sum + (e.runtime ?? fallback), 0) };
}

/** Works out the episodes, seasons and minutes a series, season or episode viewing covers on a given day. */
export async function coverageOf(tmdbId: number, season: number | null, episode: number | null, date: string | null, showRuntime: number | null): Promise<Result<Coverage>> {
  const fallback = showRuntime ?? 0;
  const limit = date && date.length === 10 ? date : today();
  if (season !== null) {
    const detail = await services.catalog.season(tmdbId, season);
    if (!detail.ok) return fail(detail.error);
    if (episode !== null) {
      const ep = detail.value.episodes.find((e) => e.episode === episode);
      return ok({ episodes: 1, seasons: 1, minutes: ep?.runtime ?? fallback });
    }
    const c = counted(detail.value.episodes, limit, fallback);
    return ok({ episodes: c.episodes, seasons: 1, minutes: c.minutes });
  }
  const all = await loadSeasons(tmdbId);
  if (!all.ok) return fail(all.error);
  let episodes = 0;
  let minutes = 0;
  let seasons = 0;
  for (const s of all.value.seasons) {
    const c = counted(s.episodes, limit, fallback);
    if (c.episodes > 0) seasons++;
    episodes += c.episodes;
    minutes += c.minutes;
  }
  return ok({ episodes, seasons, minutes });
}

/** Adds the coverage to a show entry; anything else, or a failed lookup, is returned unchanged (statistics then estimate). */
export async function withCoverage(entry: LogEntry): Promise<LogEntry> {
  if (entry.category !== "TV Show" || !entry.media) return entry;
  const res = await coverageOf(entry.media.tmdbId, entry.season, entry.episode, entry.date, entry.media.runtime);
  return res.ok ? { ...entry, episodesCovered: res.value.episodes, seasonsCovered: res.value.seasons, minutes: res.value.minutes } : entry;
}

/** Saves one viewing for the series (season and episode null), a season, or one episode. Dated today unless a date, or null for "watched before", is given. */
export async function logShowNow(details: CatalogDetails, season: number | null, episode: number | null, date: string | null = today()): Promise<Result<string>> {
  const draft = logEntrySchema.safeParse({
    category: "TV Show",
    title: details.title,
    season,
    episode,
    episodeTitle: null,
    location: null,
    address: null,
    auditorium: null,
    date,
    time: null,
    seats: [],
    totalTickets: null,
    primaryFormat: null,
    addons: [],
    rating: null,
    notes: null,
    media: mediaFromCatalog(details),
  });
  if (!draft.success) return fail("Those details are not valid.");
  const res = await services.log.saveEntry(await withCoverage(draft.data), []);
  if (!res.ok) return fail(res.error);
  if (res.value.clearedWatchlist) toast("Removed from watchlist");
  void syncCredits(res.value.mediaId, "TV Show", details.tmdbId);
  return ok(res.value.mediaId);
}
