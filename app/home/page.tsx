// app/home/page.tsx
// Home: the logo and your picture, a search pill, and rows of things to watch.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  // The titles each finished row shows, so a row below leaves them out; kept for the visit so Back finds Home as it was.
  const [claims, setClaims] = useState<Record<string, string[]>>(() => homeSnapshot.claims);
  // The deepest row that has come near the screen; it and every row above it load, so what a row leaves out never depends on load order.
  const [reach, setReach] = useState(2);
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

  const onSettled = useCallback((id: string, keys: string[]) => {
    setClaims((now) => {
      if (now[id] && now[id].join("|") === keys.join("|")) return now;
      const next = { ...now, [id]: keys };
      homeSnapshot.claims = next;
      return next;
    });
  }, []);
  const onNear = useCallback((index: number) => setReach((now) => Math.max(now, index)), []);

  // Each row leaves out what the rows above it show; null until all of them have finished.
  const blockedFor = useMemo(() => {
    const out: (Set<string> | null)[] = [];
    const above = new Set<string>();
    for (const id of rows ?? []) {
      // Once a row above has not finished, nothing below can be placed yet.
      const waiting = out.length > 0 && out[out.length - 1] === null;
      const previous = (rows ?? [])[out.length - 1];
      const blocked = waiting || (out.length > 0 && !(previous in claims)) ? null : new Set(above);
      out.push(blocked);
      for (const k of claims[id] ?? []) above.add(k);
    }
    return out;
  }, [rows, claims]);

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-5 pb-4 pt-6">
      <header className="flex items-center justify-between">
        <Wordmark className="text-3xl" />
        {/* Refresh sits just left of the picture, level with it. */}
        <div className="flex translate-y-1 items-center gap-3">
          <RoundButton icon="refresh" label="Refresh" onClick={() => { clearHomeCache(); homeSnapshot.claims = {}; setClaims({}); setNonce((n) => n + 1); }} />
          <Link href="/profile/" aria-label="Profile"><Avatar /></Link>
        </div>
      </header>

      <LogoLights />

      {/* Full width on an upright phone; centred with room either side on a sideways phone, tablet and laptop. */}
      <div className="mx-auto flex w-full items-center md:max-w-xl landscape:max-w-xl">
        <Link href="/search/" onClick={() => searchFocus.prime()} className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-neutral-100 px-4 text-base text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] dark:bg-neutral-800">
          <span className="shrink-0"><Icon name="search" size={24} /></span>
          <span className="truncate text-sm">Search movies, shows, concerts…</span>
        </Link>
      </div>

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      <HomeShortcuts nonce={nonce} />
      {rows?.map((id, i) => (
        <HomeRowSection key={id} rowId={id} nonce={nonce} load={i <= reach} index={i} onNear={onNear} blocked={blockedFor[i] ?? null} onSettled={onSettled} />
      ))}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

    </main>
  );
}
