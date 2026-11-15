// components/decor/tap.ts
// Lets decorations that sit behind the page react to a tap on the page above them.
// The page covers them, so they cannot be tapped directly; one listener on the window watches for a quick, still tap,
// leaves anything real (buttons, links, fields, popups) alone, and tells the nearest decoration under the finger.
"use client";

import { useEffect, useRef, type RefObject } from "react";

type Hit = (x: number, y: number) => void;

const targets = new Map<Element, Hit>();
let installed = false;

/** A tap on any of these belongs to the app, never to a decoration. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, nav, [role="button"], [role="dialog"], [aria-modal="true"], [data-no-decor]';
/** A tap that moves further than this, or stays down longer, is a scroll or a press, not a tap. */
const MOVE_PX = 10;
const TAP_MS = 500;
const DEFAULT_SLOP = 14;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let down: { x: number; y: number; at: number; target: Element | null } | null = null;

  window.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, at: e.timeStamp, target: e.target instanceof Element ? e.target : null };
  }, { passive: true });
  // The browser cancels the pointer when a drag turns into a scroll.
  window.addEventListener("pointercancel", () => {
    down = null;
  }, { passive: true });
  window.addEventListener("pointerup", (e) => {
    const start = down;
    down = null;
    if (!start || targets.size === 0) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_PX || e.timeStamp - start.at > TAP_MS) return;
    if (start.target?.closest(INTERACTIVE)) return;
    // While a popup or the picture viewer is open, the page behind it is not being touched.
    if (document.querySelector('[aria-modal="true"]')) return;

    let best: { hit: Hit; dist: number } | null = null;
    targets.forEach((hit, el) => {
      const box = el.getBoundingClientRect();
      // Hidden pieces (display: none, reduced motion) have no size; they must never catch a tap.
      if (box.width === 0 && box.height === 0) return;
      const slop = Number((el as HTMLElement).dataset.slop ?? DEFAULT_SLOP);
      if (e.clientX < box.left - slop || e.clientX > box.right + slop || e.clientY < box.top - slop || e.clientY > box.bottom + slop) return;
      const dist = Math.hypot(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2));
      if (!best || dist < best.dist) best = { hit, dist };
    });
    (best as { hit: Hit } | null)?.hit(e.clientX, e.clientY);
  }, { passive: true });
}

/**
 * Makes the element react to taps on it, even when the page is drawn over it. `data-slop` on the element widens
 * its catch area in pixels. While `active` is false the element is ignored.
 */
export function useDecorTap(ref: RefObject<HTMLElement | null>, on: Hit, active = true) {
  const latest = useRef(on);
  useEffect(() => {
    latest.current = on;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    install();
    targets.set(el, (x, y) => latest.current(x, y));
    return () => {
      targets.delete(el);
    };
  }, [ref, active]);
}
