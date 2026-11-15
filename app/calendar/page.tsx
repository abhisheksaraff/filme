// app/calendar/page.tsx
// A month grid of everything you watched: posters (stacked like a deck on busy days), a filter, a
// calendar download, and the picked day's viewings listed underneath.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePageState } from "@/lib/pageMemory";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { MONTH_NAMES, type StatRow } from "@/lib/domain/stats";
import { loadStatRows } from "@/lib/home/rows";
import { buildIcs, downloadText } from "@/lib/ics";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Most posters drawn in a day's deck; any more show as +N. */
const DECK = 4;
/** How far each card behind sits to the right and lower, as a share of the day's square. */
const STEP = 12;
const CARD = 100 - STEP * (DECK - 1);
const CATEGORIES = ["Movie", "TV Show", "Concert", "Live Event"];
const pad = (n: number) => String(n).padStart(2, "0");
const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function CalendarPage() {
  const ready = useRequireSession();
  const today = new Date();
  const [year, setYear] = usePageState("calendar.year", today.getFullYear());
  const [month, setMonth] = usePageState("calendar.month", today.getMonth());
  const [rows, setRows] = useState<StatRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [category, setCategory] = usePageState<string | null>("calendar.category", null);
  const [minRating, setMinRating] = usePageState("calendar.minRating", 0);
  const [filterOpen, setFilterOpen] = usePageState("calendar.filterOpen", false);
  const [picked, setPicked] = usePageState<string | null>("calendar.picked", null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled) return;
      if (res.ok) setRows(res.value);
      else setProblem(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const byDay = useMemo(() => {
    const map = new Map<string, StatRow[]>();
    for (const row of rows ?? []) {
      if (row.watchedOn?.length !== 10) continue;
      if (category && row.category !== category) continue;
      if (minRating > 0 && (row.rating ?? 0) < minRating) continue;
      map.set(row.watchedOn, [...(map.get(row.watchedOn) ?? []), row]);
    }
    return map;
  }, [rows, category, minRating]);

  const prefix = `${year}-${pad(month + 1)}`;
  const first = new Date(year, month, 1);
  // Sunday is the first column, so the first of the month sits at its weekday number.
  const offset = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => (i >= offset && i < offset + days ? i - offset + 1 : null));

  function pickDay(date: string) {
    const next = picked === date ? null : date;
    setPicked(next);
    // The list is under the grid, so bring it into view once it has been drawn.
    if (next) requestAnimationFrame(() => document.getElementById("picked-day")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function shift(by: number) {
    const next = new Date(year, month + by, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setPicked(null);
  }

  function download() {
    const events = [...byDay.entries()]
      .filter(([date]) => date.startsWith(prefix))
      .flatMap(([date, list]) =>
        list.map((row) => ({
          uid: row.id,
          title: row.title,
          date,
          description: [row.format, row.rating !== null ? `★ ${row.rating}` : null].filter(Boolean).join(" · ") || null,
          location: row.venue,
        })),
      );
    downloadText(`filme-${prefix}.ics`, buildIcs(`filmè ${MONTH_NAMES[month]} ${year}`, events));
  }

  if (!ready) return null;
  const pickedRows = picked ? byDay.get(picked) ?? [] : [];

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-4 pt-6">
      <h1 className="px-1 font-serif text-3xl tracking-tight">Calendar</h1>

      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <RoundButton icon="left" label="Previous month" size="sm" onClick={() => shift(-1)} />
          <h2 className="font-serif text-xl tracking-tight">{MONTH_NAMES[month]} {year}</h2>
          <RoundButton icon="right" label="Next month" size="sm" onClick={() => shift(1)} />
        </div>
        <div className="flex gap-2">
          <RoundButton icon="filter" label="Filter" pressed={filterOpen} onClick={() => setFilterOpen((o) => !o)} />
          <RoundButton icon="download" label="Download this month" onClick={download} />
        </div>
      </header>

      {filterOpen && (
        <div className="flex flex-col gap-3 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
          <div className="flex flex-wrap gap-2">
            {[null, ...CATEGORIES].map((c) => (
              <button key={c ?? "all"} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 ${category === c ? "border-neutral-900 dark:border-white" : "border-neutral-300 dark:border-neutral-700"}`}>
                {c ?? "All"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3">
            Rated at least
            <input type="range" min={0} max={10} step={1} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="flex-1" />
            <span className="w-6 text-right">{minRating || "any"}</span>
          </label>
        </div>
      )}

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {!rows && !problem && <div className="skeleton h-96 rounded-2xl" />}

      {rows && (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((name) => (
            <div key={name} className="pb-1 text-center text-xs text-neutral-950 dark:text-white">{name}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const date = `${prefix}-${pad(day)}`;
            // Newest first, so the latest viewing of the day is the card on top.
            const list = [...(byDay.get(date) ?? [])].reverse();
            const deck = list.slice(0, DECK);
            const single = list.length === 1;
            return (
              <button
                key={i}
                type="button"
                disabled={list.length === 0}
                onClick={() => pickDay(date)}
                className={`relative aspect-[2/3] rounded-lg text-xs ${picked === date ? "ring-2 ring-neutral-900 dark:ring-white" : ""} ${list.length ? "" : "cursor-default"}`}
              >
                {deck.map((row, n) => {
                  const poster = tmdbImageUrl(row.posterPath, "w185");
                  // A lone viewing fills the square; a busy day cascades down and to the right, each card under the last.
                  const box = single ? { left: 0, top: 0, width: "100%", height: "100%" } : { left: `${n * STEP}%`, top: `${n * STEP}%`, width: `${CARD}%`, height: `${CARD}%` };
                  return (
                    <span key={row.id} className="absolute overflow-hidden rounded-md bg-neutral-300 shadow-[0_2px_5px_rgba(0,0,0,0.4)] ring-1 ring-white/70 dark:bg-neutral-700 dark:ring-black/60" style={{ ...box, zIndex: DECK - n }}>
                      {poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                  );
                })}
                <span className={`absolute left-0.5 top-0.5 z-10 rounded px-1 font-medium leading-tight text-neutral-950 ${list.length ? "bg-white/85" : "dark:text-white"}`}>{day}</span>
                {list.length > DECK && <span className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/70 px-1 text-[10px] text-white">+{list.length - DECK}</span>}
                {single && list[0].rating !== null && (
                  <span className="absolute bottom-0.5 left-0.5 z-10 rounded bg-black/70 px-1 text-[10px] text-amber-300">★ {list[0].rating}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pickedRows.length > 0 && picked && (
        <section id="picked-day" className="flex flex-col gap-3 scroll-mt-4">
          <h2 className="px-1 font-serif text-xl">{dayLabel(picked)}</h2>
          <ul className="flex flex-col gap-3">
            {pickedRows.map((row) => {
              const poster = tmdbImageUrl(row.posterPath, "w185");
              return (
                <li key={row.id}>
                  <Link href={`/title/?id=${row.mediaId}`} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" loading="lazy" className="aspect-[2/3] w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="aspect-[2/3] w-14 shrink-0 rounded-lg bg-neutral-300 dark:bg-neutral-700" />
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <span className="font-serif text-base leading-tight">{row.title}</span>
                      <span className="text-neutral-500">{[row.venue, row.format, row.rating !== null ? `★ ${row.rating}` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
