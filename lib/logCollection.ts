// lib/logCollection.ts
// Logging a whole movie collection at once: one viewing for every film that is out, all with the same date.
import { isOut } from "@/lib/collections";
import { mediaFromCatalog } from "@/components/entryDraft";
import { syncCredits } from "@/lib/credits";
import { logEntrySchema } from "@/lib/domain/entry";
import type { CollectionDetail } from "@/lib/ports/catalog";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

/** Saves a viewing of each film already out; returns how many. Dated `date`, or undated (watched before) when null. */
export async function logCollectionNow(detail: CollectionDetail, date: string | null): Promise<Result<number>> {
  const out = detail.parts.filter(isOut);
  let done = 0;
  for (const part of out) {
    const found = await services.catalog.details({ tmdbId: part.tmdbId, kind: "Movie" });
    if (!found.ok) return fail(done > 0 ? `Logged ${done} of ${out.length} films, then ${found.error}` : found.error);
    const draft = logEntrySchema.safeParse({
      category: "Movie", title: found.value.title, season: null, episode: null, episodeTitle: null,
      location: null, address: null, auditorium: null, date, time: null, seats: [], totalTickets: null,
      primaryFormat: null, addons: [], rating: null, notes: null, media: mediaFromCatalog(found.value),
    });
    if (!draft.success) return fail("Those details are not valid.");
    const saved = await services.log.saveEntry(draft.data, []);
    if (!saved.ok) return fail(done > 0 ? `Logged ${done} of ${out.length} films, then ${saved.error}` : saved.error);
    void syncCredits(saved.value.mediaId, "Movie", part.tmdbId);
    done++;
  }
  return ok(done);
}
