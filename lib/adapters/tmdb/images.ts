// lib/adapters/tmdb/images.ts
// Image URLs come straight from TMDB's public CDN; only the API calls need the key.

const BASE = "https://image.tmdb.org/t/p";

export function tmdbImageUrl(path: string | null | undefined, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500"): string | null {
  if (!path) return null;
  // Custom posters and covers are stored as full links in our own public bucket.
  return path.startsWith("http") ? path : `${BASE}/${size}${path}`;
}
