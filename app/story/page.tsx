// app/story/page.tsx
// A full-screen recap of a day, month or year. Tap the right side to go on, the left to go back. Each slide takes its
// colours from its poster, with cut-out stickers round the edges and soft music chosen for the season or festival.
"use client";

import Icon from "@/components/Icon";
import LoadingOverlay from "@/components/LoadingOverlay";
import ProblemPopup from "@/components/ProblemPopup";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import StoryDesign from "@/components/StoryDesign";
import StoryStickers, { memoriesFor, stickersFor, type Sticker } from "@/components/StoryStickers";
import { ACCENTS } from "@/components/decor/art";
import { CHARMS } from "@/components/decor/charms";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useStoryMedia } from "@/hooks/useStoryMedia";
import { useStoryMemories } from "@/hooks/useStoryMemories";
import { useStoryMusic } from "@/hooks/useStoryMusic";
import { useStoryTheme } from "@/hooks/useStoryTheme";
import { storyThemeInput } from "@/lib/storyLoaders";
import { gradientFor, gradientFromPicture, type Gradient } from "@/lib/color";
import { moodFor } from "@/lib/domain/storyMood";
import { readCachedAppearance, readCachedMoving } from "@/lib/theme";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { buildStory, storyTitle, validPeriod, type Slide, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";
import { clearStored } from "@/lib/persistentCache";
import { homeSnapshot } from "@/lib/home/session";
import { services } from "@/lib/services";

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
  const valid = isKind(kind) && validPeriod(kind, period);

  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  /** How far a downward swipe has pulled the story, in pixels; it closes once pulled far enough. */
  const [pull, setPull] = useState(0);
  // Set once the loading circle has closed completely, so the story never appears over a half-filled circle.
  const [revealed, setRevealed] = useState(false);
  const [pulling, setPulling] = useState(false);
  /** False until the first tap on the "Tap to play" screen, which also lets the phone start the sound. */
  const [started, setStarted] = useState(() => params.get("go") === "1");
  /** Each poster's main colour as a gradient, filled in as the pictures are read. */
  const [grads, setGrads] = useState<Record<string, Gradient>>({});
  const [animate] = useState(() => readCachedAppearance().animationsEnabled);

  const mood = useMemo(() => {
    if (!valid) return null;
    return isKind(kind) ? moodFor(kind, period, readCachedMoving()) : null;
  }, [valid, kind, period]);
  const storyKey = valid ? `${kind}:${period}` : null;
  // What the AI is told: the story's own headlines, once they are known. The searches wait for its answer.
  const themeInput = useMemo(
    () =>
      slides && mood ? storyThemeInput(slides, mood, isKind(kind) ? storyTitle(kind, period) : "") : null,
    [slides, mood, kind, period],
  );
  const themeState = useStoryTheme(storyKey, themeInput);
  const media = useStoryMedia(storyKey, mood, themeState.theme);
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
      if (isKind(kind)) setSlides(buildStory(res.value, kind, period));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, valid, kind, period]);

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

  const slideNow = slides?.[index];
  const memories = useStoryMemories(slideNow?.sessionIds?.length ? slideNow.sessionIds : slides?.[0]?.sessionIds, slideNow?.heading ?? "story");

  /** The stories still to play in a replay, as "kind:period" pairs. */
  const queue = (params.get("q") ?? "").split(",").filter(Boolean);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/home/");
  }

  /** Counts taps so a tap starts the slide's time again. */
  const [taps, setTaps] = useState(0);
  const lastIndex = slides ? slides.length - 1 : 0;
  // Goes on by itself; stops on the last slide.
  useEffect(() => {
    if (!slides || !started || index >= lastIndex) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [slides, started, index, lastIndex, taps]);

  // Reaching the last slide counts as watching it to the end: it leaves the row under the search and joins the replay circle.
  const finishedMark = useRef<string | null>(null);
  useEffect(() => {
    if (!slides || !started || !isKind(kind) || index < lastIndex || finishedMark.current === `${kind}:${period}`) return;
    finishedMark.current = `${kind}:${period}`;
    const at = new Date().toISOString();
    homeSnapshot.stories = homeSnapshot.stories.map((s) => (s.kind === kind && s.period === period && !s.seen ? { ...s, seen: true, finishedAt: at } : s));
    void services.storyViews.markFinished(kind, period);
  }, [slides, started, kind, period, index, lastIndex]);

  function step(by: 1 | -1) {
    if (!slides) return;
    const next = index + by;
    if (next >= slides.length) {
      // A replay goes straight on to the next story; the tap that began it already allows sound.
      const [following, ...rest] = queue;
      const [k, p] = (following ?? "").split(":");
      if (following && isKind(k ?? null) && p && validPeriod(k as StoryKind, p)) return router.replace(`/story/?kind=${k}&period=${p}&go=1${rest.length ? `&q=${rest.join(",")}` : ""}`);
      return close();
    }
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

  // The story opens only once its AI theme, pictures and first track are ready.
  const opened = themeState.theme !== null && media.ready;
  const empty = slides !== null && slides.length === 0;
  if (!problem && !empty && !(opened && revealed)) {
    if (themeState.done && themeState.theme === null) {
      return (
        <main className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-neutral-950 px-8 text-center text-white">
          <p className="font-serif text-2xl">We couldn&apos;t make this story right now.</p>
          <div className="flex gap-3">
            <button type="button" onClick={themeState.retry} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950">Try again</button>
            <button type="button" onClick={close} className="rounded-full border border-white/40 px-5 py-2 text-sm">Close</button>
          </div>
        </main>
      );
    }
    return (
      // Pulling down closes the story while it loads, as it does once it is open. Touches on the overlay reach this wrapper through React.
      <div
        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchMove={(e) => {
          const start = touchStart.current;
          if (!start) return;
          const dy = e.touches[0].clientY - start.y;
          if (dy > 0 && dy > Math.abs(e.touches[0].clientX - start.x)) {
            setPulling(true);
            setPull(dy);
          }
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          setPulling(false);
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (dy > 120 && dy > Math.abs(dx)) return close();
          setPull(0);
        }}
      >
        {/* Nothing of the story is ready to show, so the overlay blurs the story's own colours. */}
        <div aria-hidden className="fixed inset-0" style={{ background: `linear-gradient(160deg, ${gradientFor(mood?.hue ?? 220).from}, ${gradientFor(mood?.hue ?? 220).to})`, transform: pull > 0 ? `translateY(${pull}px)` : undefined, transition: pulling ? "none" : "transform 200ms ease-out" }} />
        <LoadingOverlay offsetY={pull} active={!opened} onDone={() => setRevealed(true)} progress={((themeState.theme !== null ? 1 : 0) + (media.ready ? 1 : 0)) / 2} />
        <button type="button" aria-label="Close" onClick={close} className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[60] p-2 text-white"><Icon name="close" size={22} /></button>
      </div>
    );
  }

  const slide = slides?.[index];
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
      className="fixed inset-0 flex select-none flex-col text-white [-webkit-touch-callout:none]"
      style={{ background: `linear-gradient(160deg, ${grad.from}, ${grad.to})`, transform: pull > 0 ? `translateY(${pull}px)` : undefined, transition: pulling ? "none" : "transform 200ms ease-out" }}
      onClick={() => { music.touch(); setTaps((n) => n + 1); }}
      onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchMove={(e) => {
        const start = touchStart.current;
        if (!start) return;
        const dy = e.touches[0].clientY - start.y;
        // Only a mostly downward drag pulls the story along.
        if (dy > 0 && dy > Math.abs(e.touches[0].clientX - start.x)) {
          setPulling(true);
          setPull(dy);
        }
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        setPulling(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (dy > 120 && dy > Math.abs(dx)) return close();
        setPull(0);
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      }}
    >
      <StoryStickers pool={pool} index={index} animate={animate} memories={slide?.design?.type === "busy" || slide?.design?.type === "tickets" ? [] : memories} />
      <div className="relative z-10 flex gap-1 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides?.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            {i < index || (i === index && started && (!animate || last)) ? (
              <div className="h-full w-full bg-white" />
            ) : i === index && started ? (
              <div key={`${index}-${taps}`} className="h-full bg-white" style={{ animation: `story-fill ${SLIDE_MS}ms linear forwards` }} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="relative z-50 flex items-center justify-between px-4 py-3 text-sm text-white/70">
        <span>{isKind(kind) ? storyTitle(kind, period) : ""}{mood?.holiday ? ` · ${mood.holiday.name}` : ""}</span>
        <span className="flex items-center gap-3">
          {music.available && (
            <button type="button" aria-pressed={music.on} aria-label={music.on ? "Turn the music off" : "Turn the music on"}
              onClick={(e) => { e.stopPropagation(); music.toggle(); }} className="relative z-10 px-2">
              <Icon name={music.on ? "sound" : "mute"} size={22} />
            </button>
          )}
          {/* Throws away this story's saved look, stickers and music and builds them again. */}
          <button type="button" aria-label="Make this story again" onClick={(e) => { e.stopPropagation(); if (!storyKey) return; clearStored(`story-theme:${storyKey}`); clearStored(`story-media:${storyKey}`); window.location.reload(); }} className="relative z-10 px-2"><Icon name="refresh" size={22} /></button>
          <button type="button" aria-label="Save as picture" onClick={savePicture} className="relative z-10 px-2"><Icon name="download" size={22} /></button>
          <button type="button" aria-label="Close" onClick={close} className="relative z-10 px-2"><Icon name="close" size={22} /></button>
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
            {slide.design ? (
              <StoryDesign design={slide.design} animate={animate} memories={memories} />
            ) : poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" className="w-40 rounded-xl shadow-lg" />
            )}
            <p className="font-serif text-4xl leading-tight tracking-tight">{slide.big}</p>
            {slide.caption && <p className="text-white/70">{slide.caption}</p>}
            {themeState.theme && (
              // One caption per slide from the AI's few, going round without repeating until they run out.
              <p className="font-serif text-lg italic text-white/80">{themeState.theme.lines[index % themeState.theme.lines.length]}</p>
            )}
            {last && credits.length > 0 && (
              <ul className="absolute inset-x-6 bottom-6 flex flex-col gap-0.5 text-[11px] leading-snug text-white/50">
                {credits.slice(0, 5).map((c) => <li key={c} className="truncate">{c}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
      {slide && !started && (
        // Its own top layer over the whole story, so nothing drawn on a slide can sit above it. The tap lets the phone play sound and reaches the page's own tap handler, which starts the music.
        <button type="button" aria-label="Tap to play" onClick={() => setStarted(true)} className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 pb-[max(4rem,env(safe-area-inset-bottom))] backdrop-blur-[2px]">
          <span className="rounded-full border border-white/60 px-6 py-2 text-sm tracking-wide text-white">Tap to play</span>
        </button>
      )}
    </main>
  );
}

/** Each story in a replay starts fresh, so the page is keyed by which story it is. */
function KeyedStory() {
  const params = useSearchParams();
  return <StoryView key={`${params.get("kind")}:${params.get("period")}`} />;
}

export default function StoryPage() {
  return (
    <Suspense>
      <KeyedStory />
    </Suspense>
  );
}
