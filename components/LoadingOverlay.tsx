// components/LoadingOverlay.tsx
// A full-screen overlay that blocks the page while something is fetched or saved: film reels in black, ivory and
// two-tone, stacked one behind another and turning like the wheels of a gearbox, with a strip of film running between.
"use client";

import Portal from "@/components/Portal";
import { readCachedAppearance } from "@/lib/theme";
import { useState } from "react";

type Variant = "holes5" | "wedges6" | "spokes" | "slots10";
type Tone = "black" | "white" | "split";

interface ReelSpec {
  x: number;
  y: number;
  r: number;
  variant: Variant;
  tone: Tone;
  /** Seconds for one turn. */
  seconds: number;
  /** Reels that touch turn opposite ways, so they look meshed. */
  reverse: boolean;
  layer: "back" | "mid" | "front";
}

// Sized so that neighbours touch; the smaller the reel, the faster it turns.
const REELS: ReelSpec[] = [
  { x: 90, y: 85, r: 54, variant: "slots10", tone: "white", seconds: 16, reverse: true, layer: "back" },
  { x: 300, y: 70, r: 46, variant: "holes5", tone: "black", seconds: 14, reverse: true, layer: "back" },
  { x: 195, y: 140, r: 80, variant: "wedges6", tone: "black", seconds: 24, reverse: false, layer: "mid" },
  { x: 80, y: 200, r: 48, variant: "spokes", tone: "white", seconds: 14, reverse: true, layer: "mid" },
  { x: 322, y: 208, r: 64, variant: "holes5", tone: "split", seconds: 19, reverse: true, layer: "front" },
  { x: 200, y: 258, r: 36, variant: "holes5", tone: "black", seconds: 11, reverse: true, layer: "front" },
  { x: 352, y: 118, r: 32, variant: "slots10", tone: "white", seconds: 9.5, reverse: false, layer: "front" },
];

const rad = (deg: number) => (deg * Math.PI) / 180;
const n = (v: number) => v.toFixed(2);
const at = (r: number, deg: number): [number, number] => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

/** A circle as a path, centred on the origin, so holes can be cut out of a disc with the even-odd rule. */
const disc = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;

/** A curved slot between two radii and two angles. */
function slot(r1: number, r2: number, a1: number, a2: number): string {
  const [x1, y1] = at(r2, a1);
  const [x2, y2] = at(r2, a2);
  const [x3, y3] = at(r1, a2);
  const [x4, y4] = at(r1, a1);
  return `M${n(x1)} ${n(y1)}A${n(r2)} ${n(r2)} 0 0 1 ${n(x2)} ${n(y2)}L${n(x3)} ${n(y3)}A${n(r1)} ${n(r1)} 0 0 0 ${n(x4)} ${n(y4)}z`;
}

/** What is cut out of the reel: each variant has its own pattern of holes, wedges or slots. */
function cuts(variant: Variant, r: number): string {
  const each = (count: number, make: (i: number) => string) => Array.from({ length: count }, (_, i) => make(i)).join("");
  if (variant === "holes5") {
    return disc(0, 0, r * 0.1) + each(5, (i) => { const [x, y] = at(r * 0.55, -90 + i * 72); return disc(x, y, r * 0.2); });
  }
  if (variant === "wedges6") {
    return disc(0, 0, r * 0.09) + each(6, (i) => slot(r * 0.34, r * 0.84, i * 60 - 110, i * 60 - 70));
  }
  if (variant === "spokes") {
    return each(6, (i) => slot(r * 0.34, r * 0.86, i * 60 - 116, i * 60 - 64)) + each(5, (i) => { const [x, y] = at(r * 0.19, -90 + i * 72); return disc(x, y, r * 0.04); });
  }
  return disc(0, 0, r * 0.08) + each(10, (i) => slot(r * 0.5, r * 0.78, i * 36 + 4, i * 36 + 32)) + each(10, (i) => { const [x, y] = at(r * 0.9, i * 36 + 18); return disc(x, y, r * 0.035); });
}

function Reel({ spec, animate }: { spec: ReelSpec; animate: boolean }) {
  const { x, y, r, variant, tone, seconds, reverse, layer } = spec;
  const cut = cuts(variant, r);
  const black = tone === "black" || tone === "split";
  const ring = tone === "white" ? "#b8b09c" : "#55555b";
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* A soft shadow on whatever lies behind, which is what makes the layers read as depth. */}
      {layer !== "back" && <circle cx="4" cy="7" r={r} fill="#000" opacity="0.35" />}
      <g className={animate ? `reel ${reverse ? "reel-back" : ""}` : undefined} style={animate ? { animationDuration: `${seconds}s` } : undefined}>
        <path fillRule="evenodd" d={disc(0, 0, r) + cut} fill={black ? "url(#reel-black)" : "url(#reel-white)"} stroke={ring} strokeWidth="0.8" />
        {tone === "split" && <path fillRule="evenodd" d={disc(0, 0, r * 0.84) + cut} fill="url(#reel-white)" />}
        <circle r={r * 0.93} fill="none" stroke={tone === "split" ? "#b8b09c" : ring} strokeWidth="0.7" />
      </g>
    </g>
  );
}

function LoadingOverlayInner({ label }: { label: string }) {
  const [animate] = useState(() => readCachedAppearance().animationsEnabled);
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/85 backdrop-blur-sm">
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 400 300" aria-hidden className="w-[min(88vw,440px)]">
        <defs>
          <linearGradient id="reel-black" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#303035" />
            <stop offset="1" stopColor="#09090a" />
          </linearGradient>
          <linearGradient id="reel-white" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbf7ec" />
            <stop offset="1" stopColor="#cdc5b1" />
          </linearGradient>
        </defs>
        <g opacity="0.6">{REELS.filter((s) => s.layer === "back").map((s, i) => <Reel key={i} spec={s} animate={animate} />)}</g>
        {REELS.filter((s) => s.layer === "mid").map((s, i) => <Reel key={i} spec={s} animate={animate} />)}
        {/* The film passes in front of the middle reels and behind the front ones. */}
        <path d="M20 215C90 120 150 215 215 150S300 80 380 160" fill="none" stroke="#0b0b0c" strokeWidth="15" />
        <path d="M20 215C90 120 150 215 215 150S300 80 380 160" fill="none" stroke="#d8d2c2" strokeWidth="9" strokeDasharray="2.5 6.5" className={animate ? "film-run" : undefined} />
        {REELS.filter((s) => s.layer === "front").map((s, i) => <Reel key={i} spec={s} animate={animate} />)}
      </svg>
    </div>
  );
}

export default function LoadingOverlay({ label }: { label: string }) {
  return (
    <Portal>
      <LoadingOverlayInner label={label} />
    </Portal>
  );
}
