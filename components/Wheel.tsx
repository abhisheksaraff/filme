// components/Wheel.tsx
// A scroll wheel for picking one value from a short list, drawn by the app instead of the browser's
// dropdown. The list repeats so it rolls over: after the last value comes the first again.
"use client";

import { useLayoutEffect, useRef, useState } from "react";

const ITEM = 44;
const ROWS = 5;
const COPIES = 9;
const MIDDLE = Math.floor(COPIES / 2);

interface Props {
  items: string[];
  /** Index of the selected item. */
  value: number;
  /** Called once the wheel has come to rest on an item. */
  onChange: (index: number) => void;
  label: string;
}

export default function Wheel({ items, value, onChange, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [shown, setShown] = useState(value);
  const count = items.length;

  // Starts on the chosen item in the middle copy, so there is room to roll either way.
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = (MIDDLE * count + value) * ITEM;
    // Only the first placement; later changes come from the user's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    const at = (top: number) => (((Math.round(top / ITEM) % count) + count) % count);
    setShown(at(el.scrollTop));
    clearTimeout(timer.current);
    // Once the wheel has stopped, jump back to the middle copy; it looks identical, and it never runs out of list.
    timer.current = setTimeout(() => {
      const index = at(el.scrollTop);
      el.scrollTop = (MIDDLE * count + index) * ITEM;
      onChange(index);
    }, 140);
  }

  const pad = ((ROWS - 1) / 2) * ITEM;

  return (
    <div className="relative min-w-0 flex-1">
      {/* The row in the middle is the chosen one. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-white/15" style={{ height: ITEM }} />
      <div
        ref={box}
        role="listbox"
        aria-label={label}
        onScroll={onScroll}
        className="relative snap-y snap-mandatory overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: ITEM * ROWS, paddingTop: pad, paddingBottom: pad }}
      >
        {Array.from({ length: COPIES * count }, (_, i) => {
          const index = i % count;
          return (
            <div
              key={i}
              role="option"
              aria-selected={index === shown}
              className={`flex snap-center items-center justify-center text-lg transition-colors ${index === shown ? "font-medium text-white" : "text-white/50"}`}
              style={{ height: ITEM }}
            >
              {items[index]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
