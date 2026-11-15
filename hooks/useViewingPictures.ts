// hooks/useViewingPictures.ts
// A viewing's photos and ticket stubs, loaded when asked for (a card only asks once it is on screen).
"use client";

import { useEffect, useState } from "react";
import { keepIfSame } from "@/lib/same";
import type { StoredImage } from "@/lib/ports/images";
import { services } from "@/lib/services";

/** Last answer per viewing, so a card that scrolls away and back, or a page revisited with Back, does not start empty. */
const known = new Map<string, StoredImage[]>();

export function useViewingPictures(sessionId: string, enabled: boolean): StoredImage[] {
  const [images, setImages] = useState<StoredImage[]>(() => known.get(sessionId) ?? []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([services.images.list({ sessionId }, ["photo"]), services.images.list({ sessionId }, ["ticket"])]).then(([p, t]) => {
      if (cancelled) return;
      const all = [...(p.ok ? p.value : []), ...(t.ok ? t.value : [])];
      known.set(sessionId, all);
      setImages((prev) => keepIfSame(prev, all));
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, enabled]);

  return images;
}
