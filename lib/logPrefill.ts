// lib/logPrefill.ts
// Starts a new entry for a title the app already knows, so the form opens with it filled in.
import { mediaCategorySchema } from "@/lib/domain/media";
import type { LogEntry } from "@/lib/domain/entry";

const KEY = "filme_prefill";

export interface Prefill {
  category: LogEntry["category"];
  title: string;
  tmdbId: number | null;
  /** For a show: the season and episode to log; both null means the whole series. */
  season?: number | null;
  episode?: number | null;
}

/** Remembers the title and clears any half-finished ticket scan, ready for the entry page. */
export function startEntryFrom(prefill: Prefill): void {
  sessionStorage.removeItem("scanned_ticket_images");
  sessionStorage.removeItem("scanned_ticket_errors");
  sessionStorage.setItem(KEY, JSON.stringify(prefill));
}

/** The remembered title, once; reading it clears it. */
export function takePrefill(): Prefill | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const value = JSON.parse(raw) as Partial<Prefill>;
    const category = mediaCategorySchema.safeParse(value.category);
    if (!category.success || typeof value.title !== "string") return null;
    return {
      category: category.data,
      title: value.title,
      tmdbId: typeof value.tmdbId === "number" ? value.tmdbId : null,
      season: typeof value.season === "number" ? value.season : null,
      episode: typeof value.episode === "number" ? value.episode : null,
    };
  } catch {
    return null;
  }
}
