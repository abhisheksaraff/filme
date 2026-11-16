// components/LoadingOverlay.tsx
// A full-screen overlay that blocks the page while something is fetched or saved: the page behind it dimmed and softly
// blurred, with one white circle that fills smoothly as the work goes on. When the work ends the circle always sweeps to
// full, rests a moment, and only then fades away, so what follows never appears over a half-filled circle.
"use client";

import Portal from "@/components/Portal";
import { useEffect, useRef, useState } from "react";

interface Props {
  /**
   * How far along the work is, from 0 to 1, when that is known in steps. Leave it out when it is not: the circle then eases
   * steadily toward the end without ever claiming to be done until `active` turns false.
   */
  progress?: number | null;
  /** True while the work goes on. Turning it false finishes the circle, then fades the overlay out and calls `onDone`. */
  active?: boolean;
  /** Called once the circle is full and the overlay has gone. */
  onDone?: () => void;
  /**
   * For an overlay that is always rendered and only wanted while `active`: it stays out of sight until `active` is first
   * true. Without this, an overlay that mounts already finished still plays the fill-and-fade before calling `onDone`.
   */
  hiddenAtStart?: boolean;
}

/** An indeterminate wait stops short of full, since nothing says when it will end. */
const WAITING = 0.92;
/** A known step moves the target here, leaving a little room for the step still to come. */
const STEPPED = (p: number) => 0.08 + 0.84 * Math.min(1, Math.max(0, p));
/** How long the full circle rests, and how long the fade takes, in milliseconds. */
const HOLD_MS = 220;
const FADE_MS = 260;

const SIZE = 104;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Circle({ progress, active, onFinished }: { progress?: number | null; active: boolean; onFinished: () => void }) {
  const [shown, setShown] = useState(0.02);
  const [fading, setFading] = useState(false);
  const indeterminate = progress === undefined || progress === null;
  const target = !active ? 1 : indeterminate ? WAITING : STEPPED(progress);
  // The latest callback, kept apart so a new function on every render does not restart the timers below.
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  // Eases toward the target a little each frame, so the circle moves smoothly and never jumps between steps.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      // A slow glide when waiting with no steps, so the circle never sits still; quicker when a step has landed or the work is over.
      const rate = !active ? 4 : indeterminate ? 0.35 : 1.4;
      setShown((v) => (target - v < 0.002 ? target : v + (target - v) * Math.min(1, rate * dt)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, indeterminate]);

  // Once the work is over and the circle has closed, it rests a moment, fades, and is gone.
  const closed = !active && shown >= 0.999;
  useEffect(() => {
    if (!closed) return;
    const fade = setTimeout(() => setFading(true), HOLD_MS);
    const done = setTimeout(() => finished.current(), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [closed]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm transition-opacity"
      style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={STROKE} />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#ffffff" strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={`${shown * CIRCUMFERENCE} ${CIRCUMFERENCE}`} />
      </svg>
    </div>
  );
}

export default function LoadingOverlay({ progress, active = true, onDone, hiddenAtStart = false }: Props) {
  const [on, setOn] = useState(active || !hiddenAtStart);
  // Work starting again brings the overlay back.
  if (active && !on) setOn(true);
  if (!on) return null;
  return (
    <Portal>
      <Circle
        progress={progress}
        active={active}
        onFinished={() => {
          setOn(false);
          onDone?.();
        }}
      />
    </Portal>
  );
}
