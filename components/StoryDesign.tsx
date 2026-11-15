// components/StoryDesign.tsx
// The designed layouts for story slides: a podium of posters, a map with a poster mosaic, drawn symbols, a scrolling grid
// and a spiral of tickets. Each part sits either behind the slide's text or in its place. Still when animations are off.
"use client";

import { useEffect, useState } from "react";
import FlatMap from "@/components/FlatMap";
import Icon, { type IconName } from "@/components/Icon";
import type { Memory } from "@/hooks/useStoryMemories";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { SlideDesign } from "@/lib/domain/stories";
import type { VenuePoint } from "@/lib/ports/browse";
import { services } from "@/lib/services";

interface Tile {
  url: string;
  kind: "poster" | "stub" | "photo";
}

const rad = (deg: number) => (deg * Math.PI) / 180;
/** The back layer: sits behind the text and the stickers' own layer's content, never takes taps. */
const BACK = "pointer-events-none absolute inset-0 -z-10 overflow-hidden";

function posterTiles(posters: string[]): Tile[] {
  return posters.flatMap((path) => {
    const url = tmdbImageUrl(path, "w185");
    return url ? [{ url, kind: "poster" as const }] : [];
  });
}

/** The favourite big, with the runners-up smaller and tucked behind, marked #2 and #3. */
function Podium({ ranked }: { ranked: { title: string; posterPath: string | null }[] }) {
  const [first, second, third] = ranked;
  const url = (p?: { posterPath: string | null }) => tmdbImageUrl(p?.posterPath ?? null, "w342");
  const badge = (n: number) => (
    <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-neutral-950 shadow-lg">#{n}</span>
  );
  return (
    <>
      {/* Faded, blurred posters of the runners-up behind everything, each with its title in small text. */}
      <div className={BACK}>
        {[second, third].map((p, i) => p && url(p) && (
          <div key={p.title} className={`absolute w-36 opacity-25 ${i === 0 ? "-left-8 top-[18%] -rotate-6" : "-right-8 bottom-[16%] rotate-6"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(p) as string} alt="" className="w-full rounded-lg blur-[1.5px]" />
            <p className="mt-1 truncate text-[10px] text-white">{p.title}</p>
          </div>
        ))}
      </div>
      <div className="relative h-72 w-64">
        {third && url(third) && (
          <div className="absolute right-0 top-14 z-10 w-28 rotate-[7deg]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(third) as string} alt="" className="w-full rounded-xl shadow-xl" />
            {badge(3)}
          </div>
        )}
        {second && url(second) && (
          <div className="absolute left-0 top-12 z-20 w-32 -rotate-[8deg]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(second) as string} alt="" className="w-full rounded-xl shadow-xl" />
            {badge(2)}
          </div>
        )}
        {first && url(first) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url(first) as string} alt="" className="absolute left-1/2 top-2 z-30 w-44 -translate-x-1/2 rounded-xl shadow-2xl" />
        )}
      </div>
    </>
  );
}

/** A still map of the venue, a small mosaic of posters from there, and the other places in small text. */
function Place({ name, posters, others }: { name: string; posters: string[]; others: string[] }) {
  const [point, setPoint] = useState<VenuePoint | null>(null);
  useEffect(() => {
    let cancelled = false;
    services.browse.venuePoints().then((res) => {
      if (!cancelled && res.ok) setPoint(res.value.find((p) => p.name === name) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);
  const tiles = posterTiles(posters);
  return (
    <>
      <div className={BACK}>
        {tiles.slice(0, 3).map((t, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.url} src={t.url} alt="" className={`absolute w-32 rounded-lg opacity-20 blur-[1.5px] ${["-left-6 top-[14%] -rotate-6", "-right-8 top-[40%] rotate-6", "-left-4 bottom-[10%] rotate-3"][i]}`} />
        ))}
      </div>
      <div className="flex flex-col items-center">
        {point && (
          <div className="pointer-events-none relative isolate h-44 w-44 overflow-hidden rounded-3xl shadow-2xl">
            <FlatMap points={[point]} focus={{ lon: point.longitude, lat: point.latitude, zoom: 14 }} still pinIcon="film" className="h-full" />
          </div>
        )}
        <div className={`flex justify-center ${point ? "-mt-6" : ""}`}>
          {tiles.slice(0, 6).map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t.url} src={t.url} alt="" className={`relative w-14 rounded-md shadow-lg ${i > 0 ? "-ml-3" : ""}`} style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (4 + i)}deg)`, zIndex: i }} />
          ))}
        </div>
        {others.length > 0 && <p className="mt-3 text-xs text-white/60">Also: {others.join(" · ")}</p>}
      </div>
    </>
  );
}

const SYMBOLS: IconName[] = ["film", "ticket", "tv", "mic", "masks", "star", "image", "sparkle"];

/** Drawn symbols in a ring, turning slowly, with the other formats in small text. */
function Formats({ others, animate }: { others: string[]; animate: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-56 w-56">
        <div className={`absolute inset-0 ${animate ? "story-spin" : ""}`} style={animate ? { animationDuration: "90s" } : undefined}>
          {SYMBOLS.map((name, i) => {
            const angle = -90 + i * (360 / SYMBOLS.length);
            return (
              <span
                key={name}
                className="absolute text-white/85 drop-shadow-lg"
                style={{ left: `calc(50% + ${Math.cos(rad(angle)) * 88}px)`, top: `calc(50% + ${Math.sin(rad(angle)) * 88}px)`, transform: `translate(-50%, -50%) rotate(${i % 2 ? 12 : -12}deg)` }}
              >
                <Icon name={name} size={i % 3 === 0 ? 46 : 36} />
              </span>
            );
          })}
        </div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"><Icon name="film" size={72} /></span>
      </div>
      {others.length > 0 && <p className="mt-3 text-xs text-white/60">Also: {others.join(" · ")}</p>}
    </div>
  );
}

const COLUMN_SECONDS = [46, 62, 54, 70];

/** A tilted grid of everything from a busy stretch, each column slowly scrolling the other way. */
function Busy({ tiles, animate }: { tiles: Tile[]; animate: boolean }) {
  if (tiles.length === 0) return null;
  return (
    <div className={BACK}>
      <div className="absolute -inset-[25%] grid -rotate-12 grid-cols-4 gap-3 opacity-60">
        {COLUMN_SECONDS.map((seconds, c) => {
          // Six pictures per column, shown twice in a row so the scroll can loop without a jump.
          const column = Array.from({ length: 6 }, (_, k) => tiles[(c * 3 + k) % tiles.length]);
          return (
            <div key={c} className="flex flex-col gap-3" style={animate ? { animation: `${c % 2 ? "story-col-down" : "story-col-up"} ${seconds}s linear infinite` } : undefined}>
              {[...column, ...column].map((t, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={t.url} alt="" className={`w-full rounded-lg object-cover shadow-md ${t.kind === "poster" ? "aspect-[2/3]" : t.kind === "stub" ? "aspect-[4/3]" : "aspect-square"}`} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

/** Stubs and posters scattered along a spiral round the number, at different angles, circling slowly. */
function Spiral({ tiles, animate }: { tiles: Tile[]; animate: boolean }) {
  if (tiles.length === 0) return null;
  return (
    <div className={BACK}>
      <div className={`absolute left-1/2 top-1/2 ${animate ? "story-spin" : ""}`} style={animate ? { animationDuration: "120s" } : undefined}>
        {tiles.slice(0, 12).map((t, k) => {
          const angle = k * 137.5;
          const radius = 125 + k * 9;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={k} src={t.url} alt="" className="absolute rounded-md shadow-xl"
              style={{ width: t.kind === "poster" ? 64 : 92, left: Math.cos(rad(angle)) * radius, top: Math.sin(rad(angle)) * radius, transform: `translate(-50%, -50%) rotate(${((k * 53) % 50) - 25}deg)` }} />
          );
        })}
      </div>
    </div>
  );
}

export default function StoryDesign({ design, animate, memories }: { design: SlideDesign; animate: boolean; memories: Memory[] }) {
  if (design.type === "podium") return <Podium ranked={design.ranked} />;
  if (design.type === "place") return <Place name={design.name} posters={design.posters} others={design.others} />;
  if (design.type === "format") return <Formats others={design.others} animate={animate} />;
  const posters = posterTiles(design.posters);
  const own: Tile[] = memories.map((m) => ({ url: m.url, kind: m.kind }));
  if (design.type === "busy") return <Busy tiles={[...own, ...posters].sort((a, b) => a.url.localeCompare(b.url))} animate={animate} />;
  // Stubs first, then posters, so the number is ringed by tickets.
  return <Spiral tiles={[...own.filter((m) => m.kind === "stub"), ...posters, ...own.filter((m) => m.kind === "photo")].reduce<Tile[]>((all, t, i) => (i % 2 === 0 ? [...all, t] : [t, ...all]), [])} animate={animate} />;
}
