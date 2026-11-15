// lib/useWantedKeys.ts
// Which titles are on your watchlist, as keys a poster link can be checked against: `id:<our id>` for a title of ours
// and `tmdb:<movie|tv>:<id>` for a catalogue one. Loaded once per screen, so a row of posters costs one request.
"use client";

import { useEffect, useState } from "react";
import { services } from "@/lib/services";

export function wantedKeyOf(href: string): string | null {
  try {
    const url = new URL(href, "https://x.invalid");
    if (url.pathname.startsWith("/title/")) return url.searchParams.get("id") ? `id:${url.searchParams.get("id")}` : null;
    if (url.pathname.startsWith("/preview/")) return `tmdb:${url.searchParams.get("kind")}:${url.searchParams.get("id")}`;
  } catch {
    // A link that cannot be read simply has no badge.
  }
  return null;
}

export function useWantedKeys(): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    services.wanted.list().then((res) => {
      if (cancelled || !res.ok) return;
      const next = new Set<string>();
      for (const w of res.value) {
        next.add(`id:${w.mediaId}`);
        if (w.tmdbId !== null) next.add(`tmdb:${w.category === "TV Show" ? "tv" : "movie"}:${w.tmdbId}`);
      }
      setKeys(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return keys;
}
