// app/home/page.tsx
// Home: a top bar, a search pill and rows of things to watch built from the log, want list and TMDB.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import HomeNotices from "@/components/HomeNotices";
import HomeRowSection from "@/components/HomeRowSection";
import HomeStories from "@/components/HomeStories";
import { useRequireSession } from "@/hooks/useRequireSession";
import { resolveHomeRows } from "@/lib/domain/home";
import { clearHomeCache } from "@/lib/home/rows";
import { runMaintenance } from "@/lib/maintenance";
import { services } from "@/lib/services";
import { currentTheme, readCachedAppearance } from "@/lib/theme";

/** The device's position turned into a city name, once per visit and only if the user allows it. */
async function detectCity(): Promise<{ city: string; region: string } | null> {
  if (!("geolocation" in navigator)) return null;
  const position = await new Promise<GeolocationPosition | null>((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000, maximumAge: 3_600_000 }),
  );
  if (!position) return null;
  const res = await services.geo.reverse(position.coords.latitude, position.coords.longitude);
  return res.ok ? res.value : null;
}

export default function HomePage() {
  const ready = useRequireSession();
  const [rows, setRows] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    runMaintenance();

    services.settings.homeRows().then((layout) => {
      if (cancelled) return;
      if (!layout.ok) setProblem(layout.error);
      const theme = currentTheme(readCachedAppearance());
      const ids = resolveHomeRows(layout.ok ? layout.value : []);
      setRows(theme ? [`holiday:${theme.slug}`, ...ids] : ids);
    });

    services.settings.location().then(async (saved) => {
      if (cancelled) return;
      if (saved.ok && saved.value) setCity(saved.value.city);
      const found = await detectCity();
      if (cancelled || !found) return;
      setCity(found.city);
      await services.settings.saveLocation(found);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-32 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/profile/" aria-label="Menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M5 8h14M5 16h14" /></svg>
        </Link>
        <div className="text-center">
          <p className="text-xs text-neutral-500">Current location</p>
          <p className="text-sm font-medium">{city ?? "Set by your phone"}</p>
        </div>
        <Link href="/profile/" aria-label="Profile"><Avatar /></Link>
      </header>

      <h1 className="font-serif text-4xl tracking-tight">filmè</h1>

      <Link href="/search/" className="flex items-center gap-3 rounded-full bg-neutral-100 px-5 py-3 text-neutral-500 dark:bg-neutral-800">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>
        Search movies, shows, concerts…
      </Link>

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      <HomeNotices refresh={nonce} />
      <HomeStories nonce={nonce} />

      <div className="flex justify-end gap-4 text-sm text-neutral-500">
        <button type="button" onClick={() => { clearHomeCache(); setNonce((n) => n + 1); }}>Shuffle</button>
        <Link href="/home/customize/">Customize</Link>
      </div>
      {rows?.map((id) => <HomeRowSection key={id} rowId={id} nonce={nonce} />)}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

      <BottomNav />
    </main>
  );
}
