// hooks/useCardImdb.ts
// IMDb's page and rating for a card's title or episode. Cards on screen ask together and are answered in one batch.
"use client";

import { useEffect, useState } from "react";
import type { CatalogKind } from "@/lib/ports/catalog";
import { cardKey, type ImdbInfo } from "@/lib/ports/ratings";
import { services } from "@/lib/services";

const known = new Map<string, ImdbInfo>();
const listeners = new Map<string, Set<() => void>>();
const waiting = new Map<string, { key: string; mediaId: string; kind: CatalogKind; season: number | null; episode: number | null }>();
let timer: ReturnType<typeof setTimeout> | null = null;

function told(key: string, info: ImdbInfo) {
  known.set(key, info);
  listeners.get(key)?.forEach((fn) => fn());
}

function flush() {
  timer = null;
  const batch = [...waiting.values()];
  waiting.clear();
  void services.ratings.cardLinks(batch, told).then((found) => found.forEach((info, key) => told(key, info)));
}

/** The card's IMDb page and rating, or null while unknown or when IMDb has none. Episodes are looked up when season and episode are given. */
export function useCardImdb(mediaId: string | null, kind: CatalogKind, enabled: boolean, season?: number | null, episode?: number | null): ImdbInfo | null {
  const key = mediaId ? cardKey(mediaId, season, episode) : "";
  const [info, setInfo] = useState<ImdbInfo | null>(() => known.get(key) ?? null);
  useEffect(() => {
    if (!enabled || !mediaId) return;
    const update = () => setInfo(known.get(key) ?? null);
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(update);
    if (known.has(key)) update();
    else {
      waiting.set(key, { key, mediaId, kind, season: season ?? null, episode: episode ?? null });
      timer ??= setTimeout(flush, 60);
    }
    return () => void set.delete(update);
  }, [enabled, mediaId, key, kind, season, episode]);
  return info?.rating != null ? info : null;
}
