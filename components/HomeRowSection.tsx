// components/HomeRowSection.tsx
// One Home row: loads itself, so a slow row never holds up the others.
// It comes back exactly as it was left (no placeholder), fetches only once it is near the screen, and redraws only when its content changed.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { claimOf, loadRow, peekRow, type RowResult } from "@/lib/home/rows";
import { keepIfSame } from "@/lib/same";
import type { Result } from "@/lib/ports/result";
import { HOME_ROWS } from "@/lib/domain/home";
import Icon from "./Icon";
import PosterRow from "./PosterRow";
import ThemeIcon from "./ThemeIcon";

interface Props {
  rowId: string;
  /** Changes when the user asks for a fresh shuffle. */
  nonce: number;
  /** True for this row and every row above the deepest one that has come near the screen: those load. */
  load: boolean;
  /** This row's place in Home, and what to tell Home when it comes near the screen so it and the rows above it load. */
  index: number;
  onNear: (index: number) => void;
  /** The titles the rows above show, or null until every one of them has finished; a title shown above is left out here. */
  blocked: ReadonlySet<string> | null;
  /** Tells Home this row has finished, with the titles it shows (empty or not). */
  onSettled: (rowId: string, claims: string[]) => void;
}

/** The same shapes as a real row, so nothing moves when the pictures arrive. */
function Placeholder() {
  return (
    <ul className="-mx-5 flex gap-1.5 overflow-hidden px-5 pb-2" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex w-[134px] shrink-0 flex-col gap-1 md:w-[173px] lg:w-[192px]">
          <div className="skeleton aspect-[2/3] w-full rounded-lg" />
          <div className="skeleton h-8 w-full rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </li>
      ))}
    </ul>
  );
}

export default function HomeRowSection({ rowId, nonce, load, index, onNear, blocked, onSettled }: Props) {
  const key = `${rowId}:${nonce}`;
  // A row finished earlier this visit is shown at once.
  const [loaded, setLoaded] = useState<{ key: string; res: Result<RowResult> } | null>(() => {
    const earlier = peekRow(rowId);
    return earlier ? { key, res: earlier } : null;
  });
  const near = load || loaded !== null;
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (load) return;
    const el = box.current;
    if (!el) return;
    const watcher = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) {
        onNear(index);
        watcher.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [load, index, onNear]);

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
  // Continue watching shows everything; every other row leaves out what a row above already shows.
  const items = useMemo(() => {
    if (!done?.ok || !blocked) return [];
    return rowId === "continue" ? done.value.items : done.value.items.filter((i) => !blocked.has(claimOf(i)));
  }, [done, blocked, rowId]);
  const ready = !!done && blocked !== null;
  const empty = ready && (!done.ok || items.length === 0);
  const claims = rowId === "continue" ? "" : items.map(claimOf).join("|");

  useEffect(() => {
    if (ready) onSettled(rowId, claims === "" ? [] : claims.split("|"));
  }, [ready, claims, rowId, onSettled]);

  // A row with nothing to show (or that failed) is left out, but only once the rows above it have settled.
  if (empty) return null;

  const label = HOME_ROWS.find((row) => row.id === rowId.split(":")[0])?.label ?? (rowId.startsWith("holiday:") ? "Holiday picks" : "");
  const shown = ready && done.ok ? done.value : null;

  return (
    <section ref={box} className="flex flex-col gap-2">
      <h2 className="flex h-7 items-center gap-2 font-serif text-xl">
        {shown?.icon && <ThemeIcon slug={shown.icon} size={22} />}
        {shown ? (
          // The name opens the row's page of everything; a grey wash shows the tap, and a lighter one the pointer.
          <Link href={shown.seeAll ?? `/rows/?id=${encodeURIComponent(rowId)}`} className="-mx-2 flex items-center gap-1 rounded-lg px-2 py-0.5 transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700">
            <span>{shown.title}</span>
            <Icon name="right" size={20} />
          </Link>
        ) : label}
      </h2>
      {shown?.subtitle && <p className="-mt-1.5 text-sm text-neutral-500">{shown.subtitle}</p>}
      {shown ? <PosterRow items={items} home /> : <Placeholder />}
    </section>
  );
}
