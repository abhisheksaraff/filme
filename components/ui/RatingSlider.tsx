// components/ui/RatingSlider.tsx
// A 0 to 10 rating in half steps. The track fills black as you slide, and a round black handle carries the score.
// No rating is its own state, separate from 0: the track is empty and the handle shows a dash.
// While a finger is down, a bubble with the score floats above the handle so the finger never hides it.
"use client";

import { useState } from "react";

const THUMB = 36;
const MAX = 10;

/** 7 stays "7", 7.5 stays "7.5". */
const show = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

interface Props {
  /** The score, or null when there is none. */
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
}

export default function RatingSlider({ value, onChange, label = "Rating" }: Props) {
  const [holding, setHolding] = useState(false);
  const share = (value ?? 0) / MAX;
  // The handle's centre travels the track minus one handle width, so its edges never leave the row.
  const slide = `(100% - ${THUMB}px) * ${share}`;
  return (
    <div className="flex flex-col gap-1">
      {/* The room above is for the bubble, so it never covers the label. */}
      <div className="relative mt-12 h-9 select-none touch-pan-y">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <div aria-hidden className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-950 dark:bg-white" style={{ width: `calc(${slide} + ${THUMB / 2}px)` }} />
        <div
          aria-hidden
          className="absolute top-0 flex items-center justify-center rounded-full bg-neutral-950 text-sm font-medium text-white shadow-md dark:bg-white dark:text-neutral-950"
          style={{ width: THUMB, height: THUMB, left: `calc(${slide})` }}
        >
          {value === null ? "–" : show(value)}
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-11 flex flex-col items-center transition-opacity duration-150 ${holding ? "opacity-100" : "opacity-0"}`}
          style={{ width: THUMB, left: `calc(${slide})` }}
        >
          <span className="flex h-9 min-w-12 items-center justify-center rounded-2xl bg-neutral-950 px-3 text-base font-medium text-white dark:bg-white dark:text-neutral-950">
            {value === null ? "–" : show(value)}
          </span>
          <span className="-mt-px h-2 w-3 bg-neutral-950 [clip-path:polygon(0_0,100%_0,50%_100%)] dark:bg-white" />
        </div>
        {/* The real control sits invisibly on top, so dragging, keys and screen readers all work. Its handle is sized like the drawn one so both line up. */}
        <input
          type="range"
          min={0}
          max={MAX}
          step={0.5}
          value={value ?? 0}
          aria-label={label}
          aria-valuetext={value === null ? "No rating" : show(value)}
          onPointerDown={() => {
            setHolding(true);
            if (value === null) onChange(0);
          }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onBlur={() => setHolding(false)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-webkit-slider-thumb]:h-9 [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:h-9 [&::-moz-range-thumb]:w-9"
        />
      </div>
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} className="self-end px-1 text-xs text-neutral-500">Clear rating</button>
      )}
    </div>
  );
}
