// components/HomeRowSection.tsx
// One Home row: loads itself, so a slow row never holds up the others.
// It comes back exactly as it was left (no placeholder), fetches only once it is near the screen, and redraws only when its content changed.
"use client";

import { useEffect, useRef, useState } from "react";
import { loadRow, peekRow, type RowResult } from "@/lib/home/rows";
import { keepIfSame } from "@/lib/same";
import type { Result } from "@/lib/ports/result";
import { HOME_ROWS } from "@/lib/domain/home";
import PosterRow from "./PosterRow";
import ThemeIcon from "./ThemeIcon";

interface Props {
  rowId: string;
  /** Changes when the user asks for a fresh shuffle. */
  nonce: number;
  /** Rows at the top load straight away; the rest wait until they are close to the screen. */
  eager: boolean;
  /** True once every row above has finished, so an empty row can fold away without moving what you are reading. */
  mayFold: boolean;
  /** Tells Home this row has finished, empty or not. */
  onSettled: (rowId: string) => void;
}

/** The same shapes as a real row, so nothing moves when the pictures arrive. */
function Placeholder() {
  return (
    <ul className="-mx-5 flex gap-3 overflow-hidden px-5 pb-2" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex w-28 shrink-0 flex-col gap-1">
          <div className="skeleton aspect-[2/3] w-full rounded-lg" />
          <div className="skeleton h-8 w-full rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </li>
      ))}
    </ul>
  );
}

export default function HomeRowSection({ rowId, nonce, eager, mayFold, onSettled }: Props) {
  const key = `${rowId}:${nonce}`;
  // A row finished earlier this visit is shown at once.
  const [loaded, setLoaded] = useState<{ key: string; res: Result<RowResult> } | null>(() => {
    const earlier = peekRow(rowId);
    return earlier ? { key, res: earlier } : null;
  });
  const [near, setNear] = useState(eager || loaded !== null);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    const watcher = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) {
        setNear(true);
        watcher.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    loadRow(rowId).then((res) => {
      // A fresh answer that says the same thing changes nothing on screen.
      if (!cancelled) setLoaded((now) => (now && now.key === key ? { key, res: keepIfSame(now.res, res) } : { key, res }));
    });
    return () => {
      cancelled = true;
    };
  }, [rowId, key, near]);

  const done = loaded?.key === key ? loaded.res : null;
  const empty = !!done && (!done.ok || done.value.items.length === 0);

  useEffect(() => {
    if (done) onSettled(rowId);
  }, [done, rowId, onSettled]);

  // A row with nothing to show (or that failed) is left out, but only once the rows above it have settled.
  if (empty && mayFold) return null;

  const label = HOME_ROWS.find((row) => row.id === rowId)?.label ?? (rowId.startsWith("holiday:") ? "Holiday picks" : "");
  const shown = done?.ok && !empty ? done.value : null;

  return (
    <section ref={box} className="flex flex-col gap-2">
      <h2 className="flex h-7 items-center gap-2 font-serif text-xl">
        {shown?.icon && <ThemeIcon slug={shown.icon} size={22} />}
        {shown ? shown.title : label}
      </h2>
      {shown?.subtitle && <p className="-mt-1.5 text-sm text-neutral-500">{shown.subtitle}</p>}
      {shown ? <PosterRow items={shown.items} /> : <Placeholder />}
    </section>
  );
}
