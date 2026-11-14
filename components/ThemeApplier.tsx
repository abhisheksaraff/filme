// components/ThemeApplier.tsx
// Keeps the page's look (light or dark, holiday tint) in step with the saved settings.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { hasSession } from "@/lib/adapters/supabase/auth";
import type { Appearance } from "@/lib/domain/appearance";
import { services } from "@/lib/services";
import { APPEARANCE_EVENT, applyAppearance, cacheAppearance, readCachedAppearance } from "@/lib/theme";

export default function ThemeApplier() {
  const pathname = usePathname();
  const current = useRef<Appearance | null>(null);
  const fromServer = useRef(false);

  // Apply the saved look at once, then keep it right when the phone switches light/dark.
  useEffect(() => {
    current.current = readCachedAppearance();
    applyAppearance(current.current);

    const media = matchMedia("(prefers-color-scheme: dark)");
    const reapply = () => current.current && applyAppearance(current.current);
    const onChange = (event: Event) => {
      current.current = (event as CustomEvent<Appearance>).detail;
    };
    media.addEventListener("change", reapply);
    window.addEventListener(APPEARANCE_EVENT, onChange);
    return () => {
      media.removeEventListener("change", reapply);
      window.removeEventListener(APPEARANCE_EVENT, onChange);
    };
  }, []);

  // Fetch the account's settings once a session exists (the login page sets one without a reload).
  useEffect(() => {
    if (fromServer.current) return;
    let cancelled = false;
    hasSession().then(async (signedIn) => {
      if (!signedIn || cancelled) return;
      const res = await services.settings.appearance();
      if (cancelled || !res.ok) return;
      fromServer.current = true;
      current.current = res.value;
      cacheAppearance(res.value);
      applyAppearance(res.value);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
