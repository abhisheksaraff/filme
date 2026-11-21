// app/home/page.tsx
// Home: the logo and your picture, a search pill, and rows of things to watch.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import LogoLights from "@/components/decor/LogoLights";
import Wordmark from "@/components/Wordmark";
import HomeShortcuts from "@/components/HomeShortcuts";
import HomeRowSection from "@/components/HomeRowSection";
import Icon from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import { searchFocus } from "@/lib/searchFocus";
import { useRequireSession } from "@/hooks/useRequireSession";
import { baseRowId, expandRows, resolveHomeRows } from "@/lib/domain/home";
import { clearHomeCache } from "@/lib/home/rows";
import { homeSnapshot } from "@/lib/home/session";
import { keepIfSame } from "@/lib/same";
import { runMaintenance } from "@/lib/maintenance";
import { services } from "@/lib/services";
import { currentTheme, readCachedAppearance } from "@/lib/theme";

export default function HomePage() {
  const ready = useRequireSession();
  // Home comes back from Back exactly as it was left: the same rows, in the same order, with no placeholders.
  const [rows, setRows] = useState<string[] | null>(() => homeSnapshot.rows);
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    runMaintenance();
    Promise.all([services.settings.homeRows(), services.settings.homeShuffle()]).then(([layout, shuffle]) => {
      if (cancelled) return;
      if (!layout.ok) setProblem(layout.error);
      const theme = currentTheme(readCachedAppearance());
      let ids = resolveHomeRows(layout.ok ? layout.value : []);
      if (shuffle.ok && shuffle.value) {
        // Random order, drawn once per visit: coming back with Back keeps the order already on screen.
        const kept = homeSnapshot.rows ? [...new Set(homeSnapshot.rows.map(baseRowId))].filter((id) => ids.includes(id)) : undefined;
        if (kept && kept.length === ids.length) ids = kept;
        else {
          ids = [...ids];
          for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
          }
        }
      }
      const next = expandRows(theme ? [`holiday:${theme.slug}`, ...ids.filter((id) => id !== `holiday:${theme.slug}`)] : ids);
      // The same list changes nothing on screen.
      setRows((now) => keepIfSame(now, next));
      homeSnapshot.rows = next;
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const onSettled = useCallback((id: string) => setSettled((now) => (now.has(id) ? now : new Set(now).add(id))), []);

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-5 pb-4 pt-6">
      <header className="flex items-center justify-between">
        <Wordmark className="text-3xl" />
        <Link href="/profile/" aria-label="Profile" className="translate-y-1"><Avatar /></Link>
      </header>

      <LogoLights />

      {/* Search takes the room the buttons leave; its words are trimmed on a narrow phone. */}
      <div className="flex items-center gap-2">
        <Link href="/search/" onClick={() => searchFocus.prime()} className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-neutral-100 px-4 text-base text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] dark:bg-neutral-800">
          <span className="shrink-0"><Icon name="search" size={24} /></span>
          <span className="truncate text-sm">Search movies, shows, concerts…</span>
        </Link>
        <RoundButton icon="refresh" label="Refresh" onClick={() => { clearHomeCache(); setSettled(new Set()); setNonce((n) => n + 1); }} />
        <RoundButton icon="sliders" label="Customize Home" href="/home/customize/" />
      </div>

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      <HomeShortcuts nonce={nonce} />
      {rows?.map((id, i) => (
        <HomeRowSection key={id} rowId={id} nonce={nonce} eager={i < 3} mayFold={rows.slice(0, i).every((above) => settled.has(above))} onSettled={onSettled} />
      ))}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

    </main>
  );
}
