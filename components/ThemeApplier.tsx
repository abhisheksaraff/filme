// components/ThemeApplier.tsx
// Keeps the page's look (light or dark, holiday tint) in step with the saved settings.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { hasSession } from "@/lib/adapters/supabase/auth";
import type { Appearance } from "@/lib/domain/appearance";
import { services } from "@/lib/services";
import { MOVING_SLUGS, fallbackMovingDates } from "@/lib/domain/holidays";
import { APPEARANCE_EVENT, applyAppearance, cacheAppearance, cacheMoving, readCachedAppearance, readCachedMoving } from "@/lib/theme";

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
      window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: res.value }));
      await refreshMovingDates();
      if (!cancelled) applyAppearance(res.value);
      window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: res.value }));
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}

/**
 * Moving holidays (Diwali, Eid and so on) change every year. Once per year one AI lookup fills them
 * in, the answer is checked on the server, and it is saved so no later visit asks again.
 */
async function refreshMovingDates(): Promise<void> {
  const year = new Date().getFullYear();
  const saved = await services.settings.movingDates(year);
  if (!saved.ok) return;
  const calculated = fallbackMovingDates(year);
  // Dates the lookup has not supplied are filled from the device's own calendars.
  const known = { ...calculated, ...saved.value };
  if (MOVING_SLUGS.every((slug) => saved.value[slug])) {
    cacheMoving(saved.value);
    return;
  }
  // Don't retry on every page change if the lookup fails; try again next visit.
  const attempted = sessionStorage.getItem(`filme-moving-${year}`);
  if (attempted) {
    cacheMoving({ ...readCachedMoving(), ...known });
    return;
  }
  sessionStorage.setItem(`filme-moving-${year}`, "1");
  const missing = MOVING_SLUGS.filter((slug) => !saved.value[slug]);
  const found = await services.ai.holidayDates(year, [...missing]);
  const merged = { ...known, ...(found.ok ? found.value : {}) };
  if (found.ok) await services.settings.saveMovingDates(year, found.value);
  cacheMoving(merged);
}
