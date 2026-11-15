// hooks/useStoryMemories.ts
// Ticket stubs and photos from the viewings a story slide talks about, loaded when the slide comes up and remembered
// for the rest of the visit. They decorate the slide round its edges.
"use client";

import { useEffect, useState } from "react";
import { debugLog } from "@/lib/debug";
import { services } from "@/lib/services";

export interface Memory {
  url: string;
  kind: "stub" | "photo";
}

const known = new Map<string, Memory[]>();
/** A slide about hundreds of viewings does not ask about all of them. */
const MAX_VIEWINGS = 8;

/** Up to `max` ids spread evenly along the list, so the picks come from all through the period and not just its start. */
function spread(ids: string[], max: number): string[] {
  if (ids.length <= max) return ids;
  return Array.from({ length: max }, (_, i) => ids[Math.floor((i * ids.length) / max)]);
}

async function load(sessionId: string): Promise<Memory[]> {
  const hit = known.get(sessionId);
  if (hit) return hit;
  const [stubs, photos] = await Promise.all([services.images.list({ sessionId }, ["ticket"]), services.images.list({ sessionId }, ["photo"])]);
  const all: Memory[] = [
    ...(stubs.ok ? stubs.value.map((i): Memory => ({ url: i.url, kind: "stub" })) : []),
    ...(photos.ok ? photos.value.map((i): Memory => ({ url: i.url, kind: "photo" })) : []),
  ];
  known.set(sessionId, all);
  return all;
}

/** Stubs and photos for the given viewings, stubs first; empty until they have loaded. */
export function useStoryMemories(sessionIds: string[] | undefined, label: string): Memory[] {
  const [memories, setMemories] = useState<Memory[]>([]);
  const key = spread(sessionIds ?? [], MAX_VIEWINGS).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    Promise.all(ids.map(load)).then((lists) => {
      if (cancelled) return;
      const all = lists.flat();
      debugLog(`${label}: ${all.filter((m) => m.kind === "stub").length} stubs, ${all.filter((m) => m.kind === "photo").length} photos from ${ids.length} viewings`);
      setMemories(all);
    });
    return () => {
      cancelled = true;
    };
  }, [key, label]);

  return memories;
}
