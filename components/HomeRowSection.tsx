// components/HomeRowSection.tsx
// One Home row: loads itself, so a slow row never holds up the others.
"use client";

import { useEffect, useState } from "react";
import { loadRow, type RowResult } from "@/lib/home/rows";
import type { Result } from "@/lib/ports/result";
import { HOME_ROWS } from "@/lib/domain/home";
import PosterRow from "./PosterRow";
import ThemeIcon from "./ThemeIcon";

interface Props {
  rowId: string;
  /** Changes when the user asks for a fresh shuffle. */
  nonce: number;
}

export default function HomeRowSection({ rowId, nonce }: Props) {
  const key = `${rowId}:${nonce}`;
  const [loaded, setLoaded] = useState<{ key: string; res: Result<RowResult> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRow(rowId).then((res) => {
      if (!cancelled) setLoaded({ key, res });
    });
    return () => {
      cancelled = true;
    };
  }, [rowId, key]);

  const done = loaded?.key === key ? loaded.res : null;
  // A row with nothing to show (or that failed) is left out entirely rather than shown empty.
  if (done && (!done.ok || done.value.items.length === 0)) return null;

  const label = HOME_ROWS.find((row) => row.id === rowId)?.label ?? (rowId.startsWith("holiday:") ? "Holiday picks" : "");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-serif text-xl">
        {done?.ok && done.value.icon && <ThemeIcon slug={done.value.icon} size={22} />}
        {done?.ok ? done.value.title : label}
      </h2>
      {done?.ok && done.value.subtitle && <p className="-mt-1.5 text-sm text-neutral-500">{done.value.subtitle}</p>}
      {!done && (
        <ul className="-mx-5 flex gap-3 overflow-hidden px-5" aria-label="Loading">
          {Array.from({ length: 4 }, (_, i) => <li key={i} className="skeleton aspect-[2/3] w-28 shrink-0 rounded-lg" />)}
        </ul>
      )}
      {done?.ok && <PosterRow items={done.value.items} />}
    </section>
  );
}
