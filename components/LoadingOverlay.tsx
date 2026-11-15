// components/LoadingOverlay.tsx
// A full-screen film reel that blocks the page while something is being fetched or saved.
"use client";

import Portal from "@/components/Portal";

const HOLES = [0, 1, 2, 3, 4].map((i) => {
  const angle = ((i * 72 - 90) * Math.PI) / 180;
  return { x: 50 + 27 * Math.cos(angle), y: 50 + 27 * Math.sin(angle) };
});

function LoadingOverlayInner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-sm"
    >
      <svg
        viewBox="0 0 100 100"
        className="h-28 w-28 animate-spin text-white motion-reduce:animate-none"
        style={{ animationDuration: "2.5s" }}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      >
        <circle cx="50" cy="50" r="45" />
        <circle cx="50" cy="50" r="7" fill="currentColor" />
        {HOLES.map((hole, i) => (
          <circle key={i} cx={hole.x} cy={hole.y} r="9" fill="currentColor" stroke="none" />
        ))}
      </svg>
      <p className="text-base font-medium text-white">{label}</p>
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
