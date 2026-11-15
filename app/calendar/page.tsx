// app/calendar/page.tsx
// A month grid of everything you watched, with posters and ratings, a filter and a calendar download.
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORIES = ["Movie", "TV Show", "Concert", "Live Event"];
const pad = (n: number) => String(n).padStart(2, "0");

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
  // Monday is the first column, so Sunday (0) counts as the sixth offset.
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => (i >= offset && i < offset + days ? i - offset + 1 : null));

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
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <RoundButton icon="left" label="Previous month" size="sm" onClick={() => shift(-1)} />
          <h1 className="font-serif text-2xl tracking-tight">{MONTH_NAMES[month]} {year}</h1>
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
          {WEEKDAYS.map((name, i) => (
            <div key={name} className={`pb-1 text-center text-xs ${i === 6 ? "text-red-500" : "text-neutral-500"}`}>{name}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const date = `${prefix}-${pad(day)}`;
            const list = byDay.get(date) ?? [];
            const poster = tmdbImageUrl(list[0]?.posterPath, "w185");
            const isSunday = i % 7 === 6;
            return (
              <button
                key={i}
                type="button"
                disabled={list.length === 0}
                onClick={() => setPicked(picked === date ? null : date)}
                className={`relative flex aspect-[2/3] flex-col items-center overflow-hidden rounded-lg text-xs ${picked === date ? "ring-2 ring-neutral-900 dark:ring-white" : ""} ${list.length ? "" : "cursor-default"}`}
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : list.length > 0 ? (
                  <span className="absolute inset-0 bg-neutral-300 dark:bg-neutral-700" />
                ) : null}
                <span className={`relative z-10 mt-0.5 rounded px-1 ${list.length ? "bg-black/55 text-white" : isSunday ? "text-red-500" : ""} ${list.length && isSunday ? "text-red-300" : ""}`}>{day}</span>
                {list.length > 1 && <span className="relative z-10 mt-auto mb-0.5 rounded bg-black/60 px-1 text-[10px] text-white">+{list.length - 1}</span>}
                {list.length === 1 && list[0].rating !== null && (
                  <span className="relative z-10 mt-auto mb-0.5 rounded bg-black/60 px-1 text-[10px] text-amber-300">★ {list[0].rating}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pickedRows.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
          {pickedRows.map((row) => (
            <li key={row.id}>
              <Link href={`/title/?id=${row.mediaId}`} className="flex flex-col text-sm">
                <span className="font-medium">{row.title}</span>
                <span className="text-neutral-500">{[row.venue, row.format, row.rating !== null ? `★ ${row.rating}` : null].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <RoundButton icon="sparkle" label="Ask your log" href="/search/?ask=1" tone="dark" size="lg" className="fixed bottom-24 right-5 z-20 shadow-lg" />
    </main>
  );
}
