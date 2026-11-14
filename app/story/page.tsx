// app/story/page.tsx
// A full-screen recap of a day, month or year. Tap the right side to go on, the left to go back.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { buildStory, storyTitle, validPeriod, type Slide, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";

function isKind(value: string | null): value is StoryKind {
  return value === "day" || value === "month" || value === "year";
}

/** Writes text centred, breaking it into lines that fit the width. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = "";
  let top = y;
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, top);
      line = word;
      top += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, top);
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
  const touchStart = useRef<number | null>(null);

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

  /** Draws the current slide onto a canvas and downloads it as a PNG. */
  async function savePicture() {
    if (!slide) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#ffffff99";
    ctx.textAlign = "center";
    ctx.font = "44px sans-serif";
    ctx.fillText(slide.heading.toUpperCase(), 540, 260);
    let textTop = 900;
    if (poster) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = poster;
        await img.decode();
        const w = 520;
        const h = (img.height / img.width) * w;
        ctx.drawImage(img, 280, 340, w, h);
        textTop = 340 + h + 140;
      } catch {
        // Without the poster the text is simply placed higher.
      }
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 84px serif";
    wrap(ctx, slide.big, 540, textTop, 900, 100);
    if (slide.caption) {
      ctx.fillStyle = "#ffffffb3";
      ctx.font = "44px sans-serif";
      ctx.fillText(slide.caption, 540, textTop + 260);
    }
    ctx.fillStyle = "#ffffff66";
    ctx.font = "36px sans-serif";
    ctx.fillText("filmè", 540, 1820);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `filme-${period}-${index + 1}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  }

  if (!ready) return null;
  if (!valid) return <main className="p-6 text-sm">That story does not exist.</main>;

  const slide = slides?.[index];
  const poster = tmdbImageUrl(slide?.posterPath, "w342");

  return (
    <main
      className="fixed inset-0 flex flex-col bg-neutral-950 text-white"
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start === null) return;
        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1);
      }}
    >
      <div className="flex gap-1 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides?.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/70">
        <span>{storyTitle(kind, period)}</span>
        <span className="flex items-center gap-3">
          <button type="button" aria-label="Save as picture" onClick={savePicture} className="relative z-10 px-2">Save</button>
          <button type="button" aria-label="Close" onClick={close} className="relative z-10 px-2 text-lg">✕</button>
        </span>
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
