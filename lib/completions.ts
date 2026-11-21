// lib/completions.ts
// Keeps the stored completion cards up to date: after any viewing changes, and in the background for films logged before
// collections existed. The cards are worked out the same way the show and collection pages work them out.
import { loadCollection } from "@/lib/collections";
import { loadSeasons } from "@/lib/logShow";
import type { StackNode } from "@/lib/domain/passes";
import type { CompletionDraft } from "@/lib/ports/passes";
import { services } from "@/lib/services";
import { buildPasses } from "@/lib/showPasses";

const draftOf = (node: StackNode): CompletionDraft => ({ season: node.season, passKey: node.passKey, lastViewingId: node.last.viewingId, completedOn: node.last.date });

/** A show's season and series cards. */
async function syncShow(mediaId: string): Promise<void> {
  const detail = await services.log.titleDetail(mediaId);
  if (!detail.ok || detail.value.tmdbId === null) return;
  const [data, resets] = await Promise.all([loadSeasons(detail.value.tmdbId), services.passes.resets(mediaId)]);
  if (!data.ok) return;
  const built = buildPasses(detail.value.viewings, data.value, resets.ok ? resets.value : [], new Date().toISOString().slice(0, 10));
  await services.passes.syncCompletions(mediaId, null, built.stacks.map(draftOf));
}

/** A movie collection's card. */
export async function syncCollection(collectionId: number): Promise<void> {
  const loaded = await loadCollection(collectionId);
  if (!loaded.ok) return;
  await services.passes.syncCompletions({ collectionId }, loaded.value.detail.name, loaded.value.stacks.map(draftOf));
}

/** After a viewing of this title was added, changed, deleted or restored. Failures are quiet; the daily check catches up. */
export async function syncAfterChange(mediaId: string): Promise<void> {
  try {
    const detail = await services.log.titleDetail(mediaId);
    if (!detail.ok) return;
    if (detail.value.category === "TV Show") return await syncShow(mediaId);
    if (detail.value.category === "Movie" && detail.value.tmdbId !== null) {
      let id = await collectionOf(mediaId);
      if (id === undefined) {
        // Not looked up yet: ask the catalogue once and remember the answer.
        const found = await services.catalog.details({ tmdbId: detail.value.tmdbId, kind: "Movie" });
        if (!found.ok) return;
        await services.passes.setCollection(mediaId, found.value.collection ?? null);
        id = found.value.collection?.id ?? null;
      }
      if (id !== null) await syncCollection(id);
    }
  } catch {
    // Quiet by design.
  }
}

/** The collection a film is in: its id, null when it has none, undefined when that was never looked up. */
async function collectionOf(mediaId: string): Promise<number | null | undefined> {
  const seen = await services.passes.collectionOfMedia(mediaId);
  return seen.ok ? seen.value : undefined;
}

// The "_2" makes every phone rebuild its cards once after the cards were cleared (migration 0028).
const CHECKED_KEY = "filme_collections_checked_2";

/**
 * Once a day: looks up the collection of films logged before collections existed (a few at a time), then rebuilds the cards of every
 * collection and show watched, which also reopens a card when a new film or episode has come out.
 */
export async function dailyCompletionCheck(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(CHECKED_KEY) === today) return;
    const unchecked = await services.passes.uncheckedMovies(25);
    if (unchecked.ok) {
      for (let i = 0; i < unchecked.value.length; i += 5) {
        await Promise.all(
          unchecked.value.slice(i, i + 5).map(async (m) => {
            const found = await services.catalog.details({ tmdbId: m.tmdbId, kind: "Movie" });
            if (found.ok) await services.passes.setCollection(m.mediaId, found.value.collection ?? null);
          }),
        );
      }
    }
    const seen = await services.passes.collectionsSeen();
    if (seen.ok) for (const c of seen.value.slice(0, 40)) await syncCollection(c.collectionId);
    const shows = await services.passes.showsSeen();
    if (shows.ok) for (const mediaId of shows.value.slice(0, 80)) await syncShow(mediaId);
    // Another pass tomorrow while films are still unchecked.
    // A failed lookup (such as before the migration has run) leaves today open to try again.
    if (unchecked.ok && unchecked.value.length < 25) localStorage.setItem(CHECKED_KEY, today);
  } catch {
    // Quiet by design.
  }
}
