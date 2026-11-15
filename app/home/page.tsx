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
import { useRequireSession } from "@/hooks/useRequireSession";
import { resolveHomeRows } from "@/lib/domain/home";
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
    services.settings.homeRows().then((layout) => {
      if (cancelled) return;
      if (!layout.ok) setProblem(layout.error);
      const theme = currentTheme(readCachedAppearance());
      const ids = resolveHomeRows(layout.ok ? layout.value : []);
      const next = theme ? [`holiday:${theme.slug}`, ...ids] : ids;
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

      <Link href="/search/" className="flex items-center gap-3 rounded-full bg-neutral-100 px-5 py-3 text-base text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] dark:bg-neutral-800">
        <Icon name="search" size={24} />
        Search movies, shows, concerts…
      </Link>

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      <HomeShortcuts nonce={nonce} onShuffle={() => { clearHomeCache(); setSettled(new Set()); setNonce((n) => n + 1); }} />
      {rows?.map((id, i) => (
        <HomeRowSection key={id} rowId={id} nonce={nonce} eager={i < 3} mayFold={rows.slice(0, i).every((above) => settled.has(above))} onSettled={onSettled} />
      ))}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

    </main>
  );
}
