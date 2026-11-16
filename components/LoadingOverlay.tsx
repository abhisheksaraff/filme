// components/LoadingOverlay.tsx
// A full-screen overlay that blocks the page while something is fetched or saved: the page behind it dimmed and softly
// blurred, with one white circle that fills smoothly as the work goes on, and what is happening written under it.
"use client";

import Portal from "@/components/Portal";
import { useEffect, useState } from "react";

interface Props {
  label: string;
  /**
   * How far along the work is, from 0 to 1, when that is known in steps. Leave it out when it is not: the circle then eases
   * steadily toward the end without ever claiming to be done, and the overlay leaves the screen when the work is.
   */
  progress?: number | null;
}

/** An indeterminate wait stops short of full, since nothing says when it will end. */
const WAITING = 0.92;
/** A known step moves the target here, leaving a little room for the step still to come. */
const STEPPED = (p: number) => 0.08 + 0.84 * Math.min(1, Math.max(0, p));

const SIZE = 104;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function LoadingOverlayInner({ label, progress }: Props) {
  const [shown, setShown] = useState(0.02);
  const target = progress === undefined || progress === null ? WAITING : STEPPED(progress);

  // Eases toward the target a little each frame, so the circle moves smoothly and never jumps between steps.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      // A slow glide when waiting with no steps, so the circle never sits still; quicker when a step has just landed.
      const rate = progress === undefined || progress === null ? 0.35 : 1.4;
      setShown((v) => v + (target - v) * Math.min(1, rate * dt));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, progress]);

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/60 px-6 backdrop-blur-sm">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={STROKE} />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#ffffff" strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={`${shown * CIRCUMFERENCE} ${CIRCUMFERENCE}`} />
      </svg>
      <span className="text-center text-sm text-white">{label}</span>
    </div>
  );
}

export default function LoadingOverlay({ label, progress }: Props) {
  return (
    <Portal>
      <LoadingOverlayInner label={label} progress={progress} />
    </Portal>
  );
}
