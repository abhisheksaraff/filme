// hooks/useScopePictures.ts
// The poster and cover chosen for a season, an episode or a collection, and a way to read them again after a change.
"use client";

import { useCallback, useEffect, useState } from "react";
import { services } from "@/lib/services";

type Chosen = Partial<Record<"poster" | "backdrop", string>>;

export function useScopePictures(scope: string | null): { chosen: Chosen; reload: () => void } {
  const [chosen, setChosen] = useState<Chosen>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    services.images.chosen(scope).then((res) => !cancelled && res.ok && setChosen(res.value));
    return () => {
      cancelled = true;
    };
  }, [scope, tick]);
  return { chosen: scope ? chosen : {}, reload: useCallback(() => setTick((n) => n + 1), []) };
}
