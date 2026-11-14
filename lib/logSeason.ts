// lib/logSeason.ts
// Logs a whole season, or a whole show, as one viewing per episode.
import { mediaFromCatalog } from "@/components/entryDraft";
import { logEntrySchema } from "@/lib/domain/entry";
import { services } from "@/lib/services";
import { syncCredits } from "@/lib/credits";
import { fail, ok, type Result } from "@/lib/ports/result";

/** Saves one episode viewing for each episode; stops at the first failure and says how far it got. */
export async function logWholeSeason(tmdbId: number, season: number | null, date: string | null): Promise<Result<number>> {
  const [details, episodes] = await Promise.all([
    services.catalog.details({ kind: "TV Show", tmdbId }),
    services.catalog.episodes(tmdbId, season),
  ]);
  if (!details.ok) return fail(details.error);
  if (!episodes.ok) return fail(episodes.error);
  if (episodes.value.length === 0) return fail("No episodes were found for that.");

  let saved = 0;
  let mediaId: string | null = null;
  for (const ref of episodes.value) {
    const entry = logEntrySchema.safeParse({
      category: "TV Show",
      title: details.value.title,
      season: ref.season,
      episode: ref.episode,
      episodeTitle: null,
      location: null,
      address: null,
      auditorium: null,
      date,
      time: null,
      seats: [],
      totalTickets: null,
      primaryFormat: "Standard",
      addons: [],
      rating: null,
      notes: null,
      media: mediaFromCatalog(details.value),
    });
    if (!entry.success) return fail("Those details are not valid.");
    const res = await services.log.saveEntry(entry.data, []);
    if (!res.ok) return fail(`${res.error} (${saved} of ${episodes.value.length} episodes were saved.)`);
    mediaId = res.value.mediaId;
    saved++;
  }
  if (mediaId) void syncCredits(mediaId, "TV Show", tmdbId);
  return ok(saved);
}
