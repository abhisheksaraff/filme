// app/story/page.tsx
// A full-screen recap of a day, month or year. Tap the right side to go on, the left to go back. Each slide takes its
// colours from its poster, with cut-out stickers round the edges and soft music chosen for the season or festival.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import StoryStickers, { memoriesFor, stickersFor, type Sticker } from "@/components/StoryStickers";
import { ACCENTS } from "@/components/decor/art";
import { CHARMS } from "@/components/decor/charms";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useStoryMedia } from "@/hooks/useStoryMedia";
import { useStoryMemories } from "@/hooks/useStoryMemories";
import { useStoryMusic } from "@/hooks/useStoryMusic";
import { useStoryTheme } from "@/hooks/useStoryTheme";
import { gradientFor, gradientFromPicture, type Gradient } from "@/lib/color";
import { moodFor } from "@/lib/domain/storyMood";
import { readDebugLog, setDebugBypass } from "@/lib/debug";
import { readCachedAppearance, readCachedMoving } from "@/lib/theme";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { buildAllTime, buildStory, storyTitle, validPeriod, type Slide, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";

/** How long a slide stays before the next one. */
const SLIDE_MS = 6000;

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
  // The temporary debug story covers the whole log and asks for its pictures and music afresh every time.
  const isDebug = kind === "debug";
  const valid = isDebug || (isKind(kind) && validPeriod(kind, period));

  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  /** Each poster's main colour as a gradient, filled in as the pictures are read. */
  const [grads, setGrads] = useState<Record<string, Gradient>>({});
  const [animate] = useState(() => readCachedAppearance().animationsEnabled);

  useEffect(() => {
    if (!isDebug) return;
    setDebugBypass(true);
    return () => setDebugBypass(false);
  }, [isDebug]);
  const mood = useMemo(() => {
    if (!valid) return null;
    if (isDebug) return moodFor("year", String(new Date().getFullYear()), readCachedMoving());
    return isKind(kind) ? moodFor(kind, period, readCachedMoving()) : null;
  }, [valid, isDebug, kind, period]);
  const storyKey = valid ? `${kind}:${period}` : null;
  // What the AI is told: the story's own headlines, once they are known. The searches wait for its answer.
  const themeInput = useMemo(
    () =>
      slides && mood
        ? {
            label: isDebug ? "Everything watched" : isKind(kind) ? storyTitle(kind, period) : "",
            titles: slides.filter((s) => s.heading !== "Checks").map((s) => `${s.heading}: ${s.big}`).slice(0, 25),
            places: [],
            festival: mood.holiday?.name ?? null,
            season: mood.season,
          }
        : null,
    [slides, mood, isDebug, kind, period],
  );
  const themeState = useStoryTheme(storyKey, themeInput, isDebug);
  const media = useStoryMedia(storyKey, mood, themeState.theme, themeState.done);
  const music = useStoryMusic(media.tracks);
  // Real cut-outs when enough were found; otherwise a festival's own drawn charms.
  const pool: Sticker[] = useMemo(() => {
    if (media.stickers.length >= 2) return media.stickers.map((m) => ({ kind: "picture", url: m.url }));
    return (mood?.holiday ? CHARMS[mood.holiday.slug] ?? [] : []).filter((n) => n !== "icon" && ACCENTS[n]).map((name) => ({ kind: "charm", name }));
  }, [media.stickers, mood]);

  useEffect(() => {
    if (!ready || !valid) return;
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled) return;
      if (!res.ok) return setProblem(res.error);
      if (isDebug) setSlides([...buildAllTime(res.value), { heading: "Checks", big: "Debug", caption: null, posterPath: null, lines: [] }]);
      else if (isKind(kind)) setSlides(buildStory(res.value, kind, period));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, valid, isDebug, kind, period]);

  useEffect(() => {
    let cancelled = false;
    for (const path of new Set((slides ?? []).map((x) => x.posterPath).filter((x): x is string => x !== null))) {
      const url = tmdbImageUrl(path, "w185");
      if (!url) continue;
      gradientFromPicture(url).then((g) => {
        if (!cancelled && g) setGrads((prev) => (prev[path] ? prev : { ...prev, [path]: g }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [slides]);

  // Ticks while the debug checks are on screen, so the lines follow the searches as they finish.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isDebug) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [isDebug]);
  const slideNow = slides?.[index];
  const memories = useStoryMemories(slideNow?.sessionIds?.length ? slideNow.sessionIds : slides?.[0]?.sessionIds, slideNow?.heading ?? "story");

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/home/");
  }

  /** Counts taps so a tap starts the slide's time again. */
  const [taps, setTaps] = useState(0);
  const checksOn = isDebug && slideNow?.heading === "Checks";
  const lastIndex = slides ? slides.length - 1 : 0;
  // Goes on by itself; stops on the last slide and on the debug checks.
  useEffect(() => {
    if (!slides || index >= lastIndex || checksOn) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [slides, index, lastIndex, checksOn, taps]);

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
    const back = ctx.createLinearGradient(0, 0, 400, 1920);
    back.addColorStop(0, grad.from);
    back.addColorStop(1, grad.to);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, 1080, 1920);
    // Stickers: only pictures that were checked as readable are drawn, so the canvas stays exportable.
    for (const { sticker, slot } of stickersFor(pool, index)) {
      if (sticker.kind !== "picture") continue;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = sticker.url;
        await img.decode();
        const w = slot.size * 1080;
        const h = (img.height / img.width) * w;
        ctx.save();
        ctx.translate(slot.x * 1080, slot.y * 1920);
        ctx.rotate((slot.rot * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch {
        // A sticker that fails to load is just left out of the picture.
      }
    }
    // The slide's own stubs and photos, laid the same way as on screen; any that cannot be read are left out.
    for (const { memory, slot } of memoriesFor(memories, index)) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = memory.url;
        await img.decode();
        const w = slot.size * 1080;
        ctx.save();
        ctx.translate(slot.x * 1080, slot.y * 1920);
        ctx.rotate((slot.rot * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 14;
        if (memory.kind === "photo") {
          const frame = 16;
          const pw = w - frame * 2;
          const ph = pw * 1.25;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-w / 2, -(ph + frame * 3.5) / 2, w, ph + frame * 3.5);
          ctx.shadowColor = "transparent";
          ctx.drawImage(img, -w / 2 + frame, -(ph + frame * 3.5) / 2 + frame, pw, ph);
        } else {
          ctx.drawImage(img, -w / 2, -((img.height / img.width) * w) / 2, w, (img.height / img.width) * w);
        }
        ctx.restore();
      } catch {
        // Left out of the picture.
      }
    }
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
  // The debug checks slide: what each search found, whether anything played, and what the security policy blocked.
  const checks = isDebug && slide?.heading === "Checks"
    ? [
        `stickers: ${media.stickers.length} found, ${pool.length > 0 ? `${pool[0].kind === "picture" ? "pictures" : "drawn charms"} in use` : "none in use"}`,
        `music: ${media.tracks.length} found, ${music.playing ? "playing" : music.on ? "on, not playing" : "off"}`,
        `stubs and photos on the story: ${memories.filter((m) => m.kind === "stub").length} and ${memories.filter((m) => m.kind === "photo").length}`,
        ...readDebugLog(),
      ]
    : null;
  const poster = tmdbImageUrl(slide?.posterPath, "w342");
  const grad = (slide?.posterPath ? grads[slide.posterPath] : undefined) ?? gradientFor((mood?.hue ?? 220) + index * 28);
  const last = slides !== null && index === slides.length - 1;
  // Whatever is on screen from Openverse is credited on the last slide.
  const credits = [
    ...(music.playing ? [music.playing.credit] : []),
    ...(pool.length > 0 && pool[0].kind === "picture" ? media.stickers.map((m) => m.credit) : []),
  ].map((c) => `${c.title}${c.creator ? ` by ${c.creator}` : ""}, ${c.license}`);

  return (
    <main
      className="fixed inset-0 flex flex-col text-white"
      style={{ background: `linear-gradient(160deg, ${grad.from}, ${grad.to})` }}
      onClick={() => { music.touch(); setTaps((n) => n + 1); }}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start === null) return;
        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1);
      }}
    >
      <StoryStickers pool={pool} index={index} animate={animate} memories={isDebug && slide?.heading === "Checks" ? [] : memories} />
      <div className="relative z-10 flex gap-1 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides?.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            {i < index || (i === index && (!animate || last || checks !== null)) ? (
              <div className="h-full w-full bg-white" />
            ) : i === index ? (
              <div key={`${index}-${taps}`} className="h-full bg-white" style={{ animation: `story-fill ${SLIDE_MS}ms linear forwards` }} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between px-4 py-3 text-sm text-white/70">
        <span>{isDebug ? "Debug · all time" : isKind(kind) ? storyTitle(kind, period) : ""}{mood?.holiday ? ` · ${mood.holiday.name}` : ""}</span>
        <span className="flex items-center gap-3">
          {music.available && (
            <button type="button" aria-pressed={music.on} aria-label={music.on ? "Turn the music off" : "Turn the music on"}
              onClick={(e) => { e.stopPropagation(); music.toggle(); }} className="relative z-10 px-2">
              {music.on ? "Music on" : "Music off"}
            </button>
          )}
          <button type="button" aria-label="Save as picture" onClick={savePicture} className="relative z-10 px-2">Save</button>
          <button type="button" aria-label="Close" onClick={close} className="relative z-10 px-2 text-lg">✕</button>
        </span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => step(-1)} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-2/3" onClick={() => step(1)} />

        <ProblemPopup message={problem} onClose={() => setProblem(null)} />
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
            {themeState.theme && !checks && (
              // One caption per slide from the AI's few, going round without repeating until they run out.
              <p className="font-serif text-lg italic text-white/80">{themeState.theme.lines[index % themeState.theme.lines.length]}</p>
            )}
            {checks && (
              <ul className="flex max-h-[45vh] w-full flex-col gap-1 overflow-y-auto text-left text-xs leading-snug text-white/80">
                {checks.map((line, i) => <li key={i} className="truncate">{line}</li>)}
              </ul>
            )}
            {last && credits.length > 0 && (
              <ul className="absolute inset-x-6 bottom-6 flex flex-col gap-0.5 text-[11px] leading-snug text-white/50">
                {credits.slice(0, 5).map((c) => <li key={c} className="truncate">{c}</li>)}
              </ul>
            )}
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
