// lib/handoff.ts
// What a tile already knows about a title, passed to the page it opens so that page can draw the poster and name at once.
import type { CatalogKind } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

export interface Handoff {
  title: string;
  posterUrl: string | null;
  subtitle: string | null;
}

const known = new Map<string, Handoff>();
const keyOf = (kind: CatalogKind, tmdbId: number) => `${kind}:${tmdbId}`;

/** Reads the title out of a preview link such as /preview/?kind=movie&id=12, or null for any other link. */
function parsePreview(href: string): { kind: CatalogKind; tmdbId: number } | null {
  if (!href.startsWith("/preview/")) return null;
  const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  const kind = params.get("kind") === "movie" ? "Movie" : params.get("kind") === "tv" ? "TV Show" : null;
  const tmdbId = Number(params.get("id"));
  return kind && Number.isInteger(tmdbId) && tmdbId > 0 ? { kind, tmdbId } : null;
}

/**
 * Called when a tile is tapped (not when a finger merely lands on it to scroll, which would waste requests): keeps what the tile shows and starts fetching the full details, so by the time
 * the page opens they are usually already there.
 */
export function warmTitle(href: string, info: Handoff): void {
  const target = parsePreview(href);
  if (!target) return;
  known.set(keyOf(target.kind, target.tmdbId), info);
  void services.catalog.details(target);
  void services.catalog.images(target);
}

export function handoffFor(kind: CatalogKind | null, tmdbId: number): Handoff | null {
  return kind ? (known.get(keyOf(kind, tmdbId)) ?? null) : null;
}
