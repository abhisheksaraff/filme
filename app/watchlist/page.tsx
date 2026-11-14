// app/watchlist/page.tsx
// Entry point for logging a viewing, with the most recent ones listed below.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { DeletedEntry, RecentEntry } from "@/lib/ports/log";
import { services } from "@/lib/services";

export default function WatchlistPage() {
  const ready = useRequireSession();
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [deleted, setDeleted] = useState<DeletedEntry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([services.log.recent(20), services.log.deleted(10)]).then(([recentRes, deletedRes]) => {
      if (cancelled) return;
      if (recentRes.ok) setRecent(recentRes.value);
      else setProblem(recentRes.error);
      if (deletedRes.ok) setDeleted(deletedRes.value);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  async function restore(id: string) {
    const res = await services.log.restoreViewing(id);
    if (res.ok) setReload((n) => n + 1);
    else setProblem(res.error);
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-4 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tight">Watched</h1>
      </div>

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <ul className="grid grid-cols-2 gap-4">
        {recent.map((entry) => {
          const poster = tmdbImageUrl(entry.posterPath, "w342");
          return (
            <li key={entry.id}>
              <Link href={`/session/?id=${entry.id}`} className="flex flex-col gap-1">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
                )}
                <span className="font-serif text-base leading-tight">{entry.title}</span>
                <span className="text-xs text-neutral-500">{[entry.watchedOn, entry.primaryFormat].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          );
        })}
        {recent.length === 0 && !problem && <li className="col-span-2 text-sm text-neutral-500">Nothing logged yet.</li>}
      </ul>

      {deleted.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">Recently deleted</h2>
          <p className="text-xs text-neutral-500">Kept for 30 days, then removed for good.</p>
          <ul className="flex flex-col gap-2">
            {deleted.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{entry.title} · deleted {entry.deletedAt.slice(0, 10)}</span>
                <RoundButton icon="undo" label="Restore" size="sm" onClick={() => restore(entry.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

    </main>
  );
}
