// app/story/page.tsx
// A full-screen recap of a day, month or year. Tap the right side to go on, the left to go back.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { buildStory, storyTitle, validPeriod, type Slide, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";

function isKind(value: string | null): value is StoryKind {
  return value === "day" || value === "month" || value === "year";
}

function StoryView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const kind = params.get("kind");
  const period = params.get("period") ?? "";
  const valid = isKind(kind) && validPeriod(kind, period);

  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!ready || !isKind(kind) || !validPeriod(kind, period)) return;
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled) return;
      if (res.ok) setSlides(buildStory(res.value, kind, period));
      else setProblem(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, kind, period]);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/home/");
  }

  function step(by: 1 | -1) {
    if (!slides) return;
    const next = index + by;
    if (next >= slides.length) return close();
    setIndex(Math.max(0, next));
  }

  if (!ready) return null;
  if (!valid) return <main className="p-6 text-sm">That story does not exist.</main>;

  const slide = slides?.[index];
  const poster = tmdbImageUrl(slide?.posterPath, "w342");

  return (
    <main className="fixed inset-0 flex flex-col bg-neutral-950 text-white">
      <div className="flex gap-1 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides?.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/70">
        <span>{storyTitle(kind, period)}</span>
        <button type="button" aria-label="Close" onClick={close} className="px-2 text-lg">✕</button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => step(-1)} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-2/3" onClick={() => step(1)} />

        {problem && <p role="alert" className="text-red-400">{problem}</p>}
        {slides && slides.length === 0 && <p className="text-white/70">Nothing to show for this one yet.</p>}
        {!slides && !problem && <p className="text-white/70">Loading…</p>}

        {slide && (
          <>
            <p className="text-sm uppercase tracking-widest text-white/60">{slide.heading}</p>
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="w-40 rounded-xl shadow-lg" />
            )}
            <p className="font-serif text-4xl leading-tight tracking-tight">{slide.big}</p>
            {slide.caption && <p className="text-white/70">{slide.caption}</p>}
          </>
        )}
      </div>
    </main>
  );
}

export default function StoryPage() {
  return (
    <Suspense>
      <StoryView />
    </Suspense>
  );
}
