// components/PressFeedback.tsx
// Every button flashes dark grey for a moment when pressed, so a tap or click is always seen to land. One listener for the whole app.
"use client";

import { useEffect } from "react";

const HOLD_MS = 160;
const SELECTOR = 'button, [data-press], .press';

/** Pictures, big cards and anything marked data-nopress are left alone: a grey slab over a poster would look broken. */
function wants(el: HTMLElement): boolean {
  if (el.matches(":disabled, [aria-disabled='true'], [data-nopress]") || el.closest("[data-nopress]")) return false;
  if (el.querySelector("img, video, canvas")) return false;
  const box = el.getBoundingClientRect();
  return box.height <= 110 && box.width <= 320;
}

export default function PressFeedback() {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (!target || !wants(target)) return;
      // A button with no background of its own (a plain text button) dims instead; a filled one goes dark grey.
      const filled = target.classList.contains("press") || getComputedStyle(target).backgroundColor !== "rgba(0, 0, 0, 0)";
      const cls = filled ? "is-pressed" : "is-pressed-soft";
      const since = Date.now();
      target.classList.add(cls);
      const release = () => {
        document.removeEventListener("pointerup", release, true);
        document.removeEventListener("pointercancel", release, true);
        setTimeout(() => target.classList.remove(cls), Math.max(0, HOLD_MS - (Date.now() - since)));
      };
      document.addEventListener("pointerup", release, true);
      document.addEventListener("pointercancel", release, true);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, []);
  return null;
}
