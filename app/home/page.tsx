// app/home/page.tsx
// Home: the logo and your picture, a search pill, and rows of things to watch.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Wordmark from "@/components/Wordmark";
import HomeShortcuts from "@/components/HomeShortcuts";
import HomeRowSection from "@/components/HomeRowSection";
import Icon from "@/components/Icon";
import { useRequireSession } from "@/hooks/useRequireSession";
import { resolveHomeRows } from "@/lib/domain/home";
import { clearHomeCache } from "@/lib/home/rows";
import { runMaintenance } from "@/lib/maintenance";
import { services } from "@/lib/services";
import { currentTheme, readCachedAppearance } from "@/lib/theme";

export default function HomePage() {
  const ready = useRequireSession();
  const [rows, setRows] = useState<string[] | null>(null);
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
      setRows(theme ? [`holiday:${theme.slug}`, ...ids] : ids);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-4 pt-6">
      <header className="flex items-center justify-between">
        <Wordmark className="text-3xl" />
        <Link href="/profile/" aria-label="Profile" className="translate-y-1"><Avatar /></Link>
      </header>

      <Link href="/search/" className="flex items-center gap-3 rounded-full bg-neutral-100 px-5 py-3 text-base text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] dark:bg-neutral-800">
        <Icon name="search" size={24} />
        Search movies, shows, concerts…
      </Link>

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      <HomeShortcuts nonce={nonce} onShuffle={() => { clearHomeCache(); setNonce((n) => n + 1); }} />
      {rows?.map((id) => <HomeRowSection key={id} rowId={id} nonce={nonce} />)}
      {!rows && <div className="skeleton h-40 rounded-2xl" />}

    </main>
  );
}
