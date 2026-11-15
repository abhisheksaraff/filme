// app/profile/hidden/page.tsx
// Titles marked "Not interested", with a way to bring each one back into Home's recommendations.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmPopup } from "@/components/Popup";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { clearHomeCache, previewHref } from "@/lib/home/rows";
import type { HiddenTitle } from "@/lib/ports/hidden";
import { services } from "@/lib/services";
import { toast } from "@/lib/toast";

export default function HiddenPage() {
  const ready = useRequireSession();
  const [titles, setTitles] = useState<HiddenTitle[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState<HiddenTitle | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.hidden.list().then((res) => {
      if (cancelled) return;
      if (res.ok) setTitles(res.value);
      else setProblem(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function undo() {
    if (!asking) return;
    setBusy(true);
    const res = await services.hidden.restore(asking.category, asking.tmdbId);
    setBusy(false);
    if (!res.ok) {
      setAsking(null);
      return setProblem(res.error);
    }
    const gone = asking;
    setTitles((list) => list?.filter((t) => !(t.category === gone.category && t.tmdbId === gone.tmdbId)) ?? null);
    setAsking(null);
    clearHomeCache();
    toast("Back in recommendations");
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-4 pt-6">
      <h1 className="font-serif text-3xl tracking-tight">Not interested</h1>
      <p className="text-sm text-neutral-500">These stay out of your Home recommendations. Search still finds them.</p>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {!titles && !problem && <div className="skeleton h-40 rounded-2xl" />}
      {titles && titles.length === 0 && <p className="text-sm text-neutral-500">Nothing hidden.</p>}

      <ul className="flex flex-col gap-3">
        {titles?.map((t) => (
          <li key={`${t.category}:${t.tmdbId}`} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-900">
            <Link href={previewHref(t.category, t.tmdbId)} className="flex min-w-0 flex-1 items-center gap-3">
              {t.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tmdbImageUrl(t.posterPath, "w185") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-12 rounded-lg object-cover" />
              ) : (
                <span className="block aspect-[2/3] w-12 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
              )}
              <span className="flex min-w-0 flex-col text-sm">
                <span className="font-serif text-base leading-tight">{t.title}</span>
                <span className="text-neutral-500">{t.category}</span>
              </span>
            </Link>
            <RoundButton icon="undo" label="Undo" size="sm" onClick={() => setAsking(t)} />
          </li>
        ))}
      </ul>

      {asking && (
        <ConfirmPopup
          title="Recommend this again?"
          message={`${asking.title} can show up on Home again.`}
          confirmLabel="Undo"
          busy={busy}
          onConfirm={undo}
          onCancel={() => setAsking(null)}
        />
      )}
    </main>
  );
}
