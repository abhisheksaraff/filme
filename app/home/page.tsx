// app/home/page.tsx
// Home: rows of things to watch, built from the user's log, want-to-watch list and TMDB.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import HomeRowSection from "@/components/HomeRowSection";
import HomeStories from "@/components/HomeStories";
import { useRequireSession } from "@/hooks/useRequireSession";
import { DEFAULT_APPEARANCE } from "@/lib/domain/appearance";
import { activeHoliday } from "@/lib/domain/holidays";
import { resolveHomeRows } from "@/lib/domain/home";
import { clearHomeCache } from "@/lib/home/rows";
import { services } from "@/lib/services";

export default function HomePage() {
  const ready = useRequireSession();
  const [rows, setRows] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.settings.homeRows(), services.settings.appearance()]).then(([layout, look]) => {
      if (cancelled) return;
      if (!layout.ok) setProblem(layout.error);
      const holiday = activeHoliday(new Date(), look.ok ? look.value : DEFAULT_APPEARANCE);
      const ids = resolveHomeRows(layout.ok ? layout.value : []);
      setRows(holiday ? [`holiday:${holiday.slug}`, ...ids] : ids);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tight">Home</h1>
        <div className="flex gap-4 text-sm text-neutral-500">
          <button
            type="button"
            onClick={() => {
              clearHomeCache();
              setNonce((n) => n + 1);
            }}
          >
            Shuffle
          </button>
          <Link href="/home/customize/">Customize</Link>
        </div>
      </div>

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      <HomeStories nonce={nonce} />
      {rows?.map((id) => <HomeRowSection key={id} rowId={id} nonce={nonce} />)}

      <BottomNav />
    </main>
  );
}
