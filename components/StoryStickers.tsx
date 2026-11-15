// components/StoryStickers.tsx
// Cut-out pictures scattered round the edges of a story slide, slightly tilted and drifting, like stickers.
"use client";

import { Accent } from "@/components/decor/art";
import type { Memory } from "@/hooks/useStoryMemories";

export type Sticker = { kind: "picture"; url: string } | { kind: "charm"; name: string };

/** Where stickers sit: centre as a share of the screen, tilt in degrees and width as a share of the screen. */
export const SLOTS = [
  { x: 0.1, y: 0.2, rot: -14, size: 0.22 },
  { x: 0.9, y: 0.16, rot: 12, size: 0.2 },
  { x: 0.08, y: 0.78, rot: 10, size: 0.2 },
  { x: 0.92, y: 0.84, rot: -10, size: 0.22 },
  { x: 0.04, y: 0.5, rot: -8, size: 0.16 },
  { x: 0.96, y: 0.52, rot: 8, size: 0.16 },
];

/** Two stickers for a slide, spread over different edges, changing from slide to slide. */
export function stickersFor(pool: Sticker[], index: number): { sticker: Sticker; slot: (typeof SLOTS)[number] }[] {
  if (pool.length === 0) return [];
  return [0, 1].map((k) => ({ sticker: pool[(index * 2 + k) % pool.length], slot: SLOTS[(index + k * 3) % SLOTS.length] }));
}

/**
 * Where a slide's own ticket stubs and photos lie: half off the screen at the edges, tilted like things dropped on a table.
 * Centre and width are shares of the screen; "side" says which edge it hangs over.
 */
export const MEMORY_SLOTS = [
  { x: 0.02, y: 0.3, rot: -16, size: 0.4 },
  { x: 0.98, y: 0.7, rot: 13, size: 0.4 },
  { x: 0.04, y: 0.86, rot: 9, size: 0.34 },
  { x: 0.96, y: 0.2, rot: -9, size: 0.34 },
];

/** Up to four pieces for a slide: stubs lie flat, photos become little prints. Different ones on each slide. */
export function memoriesFor(memories: Memory[], index: number): { memory: Memory; slot: (typeof MEMORY_SLOTS)[number] }[] {
  if (memories.length === 0) return [];
  const count = Math.min(memories.length, MEMORY_SLOTS.length);
  return Array.from({ length: count }, (_, k) => ({ memory: memories[(index + k) % memories.length], slot: MEMORY_SLOTS[(k + index) % MEMORY_SLOTS.length] }));
}

export default function StoryStickers({ pool, index, animate, memories = [] }: { pool: Sticker[]; index: number; animate: boolean; memories?: Memory[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* A photo on the slide also washes softly behind everything, blurred and tinted by the slide's colours. */}
      {memoriesFor(memories, index).find((m) => m.memory.kind === "photo") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={memoriesFor(memories, index).find((m) => m.memory.kind === "photo")?.memory.url} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
      )}
      {memoriesFor(memories, index).map(({ memory, slot }, k) => (
        <div
          key={`m-${index}-${k}`}
          className={animate ? "sticker-drift" : ""}
          style={{ position: "absolute", left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.size * 100}%`, maxWidth: 220, transform: `translate(-50%, -50%) rotate(${slot.rot}deg)`, animationDelay: `${k * -1.7}s`, filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.4))" }}
        >
          {memory.kind === "photo" ? (
            <div className="bg-white p-1.5 pb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={memory.url} alt="" crossOrigin="anonymous" className="aspect-[4/5] w-full object-cover" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={memory.url} alt="" crossOrigin="anonymous" className="h-auto w-full rounded-md" />
          )}
        </div>
      ))}
      {stickersFor(pool, index).map(({ sticker, slot }, k) => (
        <div
          key={`${index}-${k}`}
          className={animate ? "sticker-drift" : ""}
          style={{ position: "absolute", left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.size * 100}%`, maxWidth: 170, transform: `translate(-50%, -50%) rotate(${slot.rot}deg)`, animationDelay: `${k * -2.5}s`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}
        >
          {sticker.kind === "picture" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sticker.url} alt="" crossOrigin="anonymous" className="h-auto w-full" />
          ) : (
            <Accent name={sticker.name} size={120} style={{ width: "100%", height: "auto" }} />
          )}
        </div>
      ))}
    </div>
  );
}
