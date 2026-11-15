// components/decor/Touchy.tsx
// Small wrappers that make a decoration react when tapped: pop into sprinkles, swing, flicker, or fall off the screen.
"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDecorTap } from "./tap";

/** A little burst of sprinkles around the middle of the nearest positioned parent. */
export function Bits({ colors, count = 10 }: { colors: readonly string[]; count?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className="pop-bit"
          style={{ "--a": `${i * (360 / count) + (i % 2) * 9}deg`, "--d": `${24 + (i % 3) * 11}px`, background: colors[i % colors.length] } as CSSProperties}
        />
      ))}
    </span>
  );
}

interface PieceProps {
  className?: string;
  style?: CSSProperties;
  colors: readonly string[];
  /** `pop` bursts into sprinkles and vanishes; `kick` just swings harder for a moment. */
  mode?: "pop" | "kick";
  /** When a popped piece returns: `loop` is on its next pass across the screen, a number is milliseconds. */
  back?: "loop" | number;
  /** How far outside the piece a finger still counts as a tap on it. */
  slop?: number;
  children: ReactNode;
}

/** A piece of scenery that reacts to a tap. The outer span keeps the caller's positioning and animation. */
export function Piece({ className, style, colors, mode = "pop", back = 8000, slop = 14, children }: PieceProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "gone" | "kick">("idle");
  const [bits, setBits] = useState(false);
  const back_ = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bits_ = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(back_.current);
    clearTimeout(bits_.current);
  }, []);

  useDecorTap(ref, () => {
    if (mode === "kick") {
      setState("kick");
      back_.current = setTimeout(() => setState("idle"), 1400);
      return;
    }
    setState("gone");
    setBits(true);
    bits_.current = setTimeout(() => setBits(false), 750);
    if (back !== "loop") back_.current = setTimeout(() => setState("idle"), back);
  }, state === "idle");

  return (
    <span
      ref={ref}
      data-slop={slop}
      className={className}
      style={style}
      onAnimationIteration={(e) => {
        if (back === "loop" && e.target === e.currentTarget && state === "gone") setState("idle");
      }}
    >
      <span className={`decor-piece block ${state === "gone" ? "decor-gone" : ""} ${state === "kick" ? "kick" : ""}`}>{children}</span>
      {bits && <Bits colors={colors} />}
    </span>
  );
}

/** Lights that flicker for a moment when tapped; `on` tells the children when. */
export function Flickers({ children, className }: { children: (on: boolean) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useDecorTap(ref, () => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), 1500);
  });
  return <div ref={ref} className={className}>{children(on)}</div>;
}

/** Comes loose when tapped, tumbles off the bottom of the screen and stays gone until the page changes. */
export function Falls({ children, className, style, slop = 16 }: { children: ReactNode; className?: string; style?: CSSProperties; slop?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fell, setFell] = useState(false);
  useDecorTap(ref, () => setFell(true), !fell);
  return (
    <span ref={ref} data-slop={slop} className={`inline-block ${fell ? "accent-fall" : ""} ${className ?? ""}`} style={style}>
      {children}
    </span>
  );
}
