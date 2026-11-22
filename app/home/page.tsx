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
import { searchFocus } from "@/lib/searchFocus";
import { useRequireSession } from "@/hooks/useRequireSession";
import { baseRowId, expandRows, resolveHomeRows } from "@/lib/domain/home";
import { clearHomeCache } from "@/lib/home/rows";
import { homeSnapshot } from "@/lib/home/session";
import { keepIfSame } from "@/lib/same";
import { useStoryShortcuts } from "@/hooks/useStoryShortcuts";
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
  // Bumped by a tap on the logo: the rows are put in order again (a new random order when shuffle is on).
  const [order, setOrder] = useState(0);
  // Stories not watched to the end show under the search; watched ones wait behind the grey circle at the top, latest first.
  const stories = useStoryShortcuts(nonce);
  const fresh = useMemo(() => stories.filter((s) => !s.seen), [stories]);
  const replay = useMemo(() => stories.filter((s) => s.seen).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "")), [stories]);
  const replayHref = replay.length === 0 ? null : `${replay[0].href}${replay.length > 1 ? `&q=${replay.slice(1).map((s) => `${s.kind}:${s.period}`).join(",")}` : ""}`;

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
  }, [ready, order]);

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

  /** Like the logo on YouTube: back to the top, with every row picking fresh titles. */
  function refreshHome() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    clearHomeCache();
    homeSnapshot.claims = {};
    homeSnapshot.rows = null;
    setClaims({});
    setOrder((n) => n + 1);
    setNonce((n) => n + 1);
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl wide:max-w-[min(94vw,88rem)] flex-col gap-5 px-5 pb-4 pt-6 wide:pt-4">
      {/* Upright phone: logo and picture on one line, then the search. Big landscape screen: logo, search and picture all on one line. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-5 wide:grid-cols-[1fr_minmax(0,36rem)_1fr]">
        {/* Tapping the logo refreshes Home; a grey wash shows the tap, and a lighter one the pointer. */}
        <button type="button" aria-label="Refresh Home" onClick={refreshHome} className="col-start-1 row-start-1 -mx-2 justify-self-start rounded-xl px-2 py-0.5 transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700">
          <Wordmark className="text-3xl" />
        </button>
        <div className="col-start-2 row-start-1 flex translate-y-1 items-center gap-3 justify-self-end wide:col-start-3 wide:translate-y-0">
          {/* The stories you have watched, one after another; gone once they have all expired. */}
          {replayHref && (
            <Link href={replayHref} aria-label="Watch your stories again" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <Icon name="calendar" size={20} />
            </Link>
          )}
          <Link href="/profile/" aria-label="Profile"><Avatar /></Link>
        </div>

        <div className="col-span-full row-start-2 empty:hidden"><LogoLights /></div>

        {/* Full width on an upright phone; centred with room either side on a sideways phone, tablet and laptop. */}
        <div className="col-span-2 row-start-3 mx-auto flex w-full items-center md:max-w-xl landscape:max-w-xl wide:col-span-1 wide:col-start-2 wide:row-start-1">
          <Link href="/search/" onClick={() => searchFocus.prime()} className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-neutral-100 px-4 text-base text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] dark:bg-neutral-800">
            <span className="shrink-0"><Icon name="search" size={24} /></span>
            <span className="truncate text-sm">Search movies, shows, concerts…</span>
          </Link>
        </div>
      </div>

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      <HomeShortcuts stories={fresh} />
      {rows?.map((id, i) => (
        <HomeRowSection key={id} rowId={id} nonce={nonce} load={i <= reach} index={i} onNear={onNear} blocked={blockedFor[i] ?? null} onSettled={onSettled} />
      ))}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

    </main>
  );
}
