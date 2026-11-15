// components/StoryStickers.tsx
// Cut-out pictures scattered round the edges of a story slide, slightly tilted and drifting, like stickers.
"use client";

import { Accent } from "@/components/decor/art";

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

export default function StoryStickers({ pool, index, animate }: { pool: Sticker[]; index: number; animate: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
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
