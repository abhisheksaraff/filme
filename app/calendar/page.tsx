// app/calendar/page.tsx
// Months of everything you watched as one long strip you swipe along, with posters (stacked like a
// deck on busy days), a month and year picker, a filter, a calendar download, and the picked day's
// viewings listed underneath.
"use client";

import { keepIfSame } from "@/lib/same";
import RatingSlider from "@/components/ui/RatingSlider";
import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePageState } from "@/lib/pageMemory";
import MonthPicker from "@/components/MonthPicker";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { MONTH_NAMES, type StatRow } from "@/lib/domain/stats";
import { loadStatRows } from "@/lib/home/rows";
import { groupByShow, scopeLabel } from "@/lib/domain/tv";
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

/** Months kept in the strip on each side of the middle one; the strip is re-centred when you near an end. */
const HALF = 36;
const PANELS = HALF * 2 + 1;
/** Panels this close to the visible one draw their days; the rest are empty placeholders. */
const DRAWN = 2;

const abs = (year: number, month: number) => year * 12 + month;

interface GridProps {
  /** Months since year 0: year * 12 + month. */
  index: number;
  byDay: Map<string, StatRow[]>;
  picked: string | null;
  onPick: (date: string) => void;
}

/** One month's seven-column grid. Memoised so swiping does not redraw months that did not change. */
const MonthGrid = memo(function MonthGrid({ index, byDay, picked, onPick }: GridProps) {
  const year = Math.floor(index / 12);
  const month = index % 12;
  const prefix = `${year}-${pad(month + 1)}`;
  // Sunday is the first column, so the first of the month sits at its weekday number.
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => (i >= offset && i < offset + days ? i - offset + 1 : null));

  return (
    <div className="cal-grid grid grid-cols-7 gap-1" style={{ "--weeks": cells.length / 7 } as React.CSSProperties}>
      {WEEKDAYS.map((name) => (
        <div key={name} className="pb-1 text-center text-xs text-neutral-950 dark:text-white">{name}</div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={i} />;
        const date = `${prefix}-${pad(day)}`;
        // Newest first, so the latest viewing of the day is the card on top.
        // Several viewings of one show on a day (episodes, a season) share one card.
        const list = groupByShow([...(byDay.get(date) ?? [])].reverse());
        const deck = list.slice(0, DECK);
        const single = list.length === 1;
        return (
          <button
            key={i}
            type="button"
            disabled={list.length === 0}
            onClick={() => onPick(date)}
            className={`relative aspect-[2/3] rounded-lg text-xs ${picked === date ? "ring-2 ring-neutral-900 dark:ring-white" : ""} ${list.length ? "" : "cursor-default"}`}
          >
            {deck.map((group, n) => {
              const row = group[0];
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
            <span className={`absolute left-1.5 top-0.5 z-10 rounded px-1 font-medium leading-tight text-neutral-950 ${list.length ? "bg-white/85" : "dark:text-white"}`}>{day}</span>
            {list.length > DECK && <span className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/70 px-1 text-[10px] text-white">+{list.length - DECK}</span>}
            {single && list[0].length === 1 && list[0][0].rating !== null && (
              <span className="absolute bottom-0.5 left-0.5 z-10 rounded bg-black/70 px-1 text-[10px] text-amber-300">★ {list[0][0].rating}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

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
  const [pickerOpen, setPickerOpen] = useState(false);

  /** The month in the middle of the strip; the strip is rebuilt around a new one when you near its end. */
  const [middle, setMiddle] = useState(() => abs(year, month));
  const strip = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Set while the strip is being moved by the code, so those scroll events are not mistaken for swipes. */
  const moving = useRef(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled) return;
      if (res.ok) setRows((prev) => keepIfSame(prev, res.value));
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

  const current = abs(year, month);
  const prefix = `${year}-${pad(month + 1)}`;
  const first = middle - HALF;

  /** Puts the strip so the given panel is in view, without animation. */
  function jump(panel: number) {
    const el = strip.current;
    if (!el) return;
    moving.current = true;
    el.scrollTo({ left: panel * el.clientWidth, behavior: "instant" });
    // Scroll events from this jump arrive on the next frames; they are ignored until then.
    requestAnimationFrame(() => requestAnimationFrame(() => { moving.current = false; }));
  }

  // Shows the chosen month when the strip first appears and after it has been rebuilt around a new middle.
  useLayoutEffect(() => {
    jump(current - first);
    // Only a new middle (or the first draw) repositions the strip; ordinary swipes move it themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [middle, rows !== null]);

  function onScroll() {
    const el = strip.current;
    if (!el || moving.current || el.clientWidth === 0) return;
    const panel = Math.round(el.scrollLeft / el.clientWidth);
    const index = first + panel;
    if (index !== current) {
      setYear(Math.floor(index / 12));
      setMonth(index % 12);
      // The list under the grid belongs to a month, so it closes when you move to another.
      setPicked(null);
    }
    // Near either end, rebuild the strip around the month in view once the swiping has stopped.
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (panel < 6 || panel > PANELS - 7) setMiddle(index);
    }, 160);
  }

  useEffect(() => () => clearTimeout(settle.current), []);

  /** Glides to a month; a long way off, it jumps instead of scrolling past every month between. */
  function goTo(index: number) {
    const el = strip.current;
    if (!el) return;
    const panel = index - first;
    setPicked(null);
    if (panel < 0 || panel >= PANELS) {
      setYear(Math.floor(index / 12));
      setMonth(index % 12);
      setMiddle(index);
    } else if (Math.abs(panel - Math.round(el.scrollLeft / el.clientWidth)) > 3) {
      jump(panel);
      setYear(Math.floor(index / 12));
      setMonth(index % 12);
    } else {
      el.scrollTo({ left: panel * el.clientWidth, behavior: "smooth" });
    }
  }

  function pickDay(date: string) {
    const next = picked === date ? null : date;
    setPicked(next);
    // The list is under the grid, so bring it into view once it has been drawn.
    if (next) requestAnimationFrame(() => document.getElementById("picked-day")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
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
  const pickedRows = picked ? groupByShow(byDay.get(picked) ?? []) : [];
  const visible = current - first;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-4 px-4 pb-4 pt-6">
      <h1 className="px-1 font-serif text-3xl tracking-tight">Calendar</h1>

      <header className="mt-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <RoundButton icon="left" label="Previous month" size="sm" onClick={() => goTo(current - 1)} />
          <button type="button" onClick={() => setPickerOpen(true)} aria-label="Choose month and year" className="rounded-full px-2 py-1 font-serif text-xl tracking-tight">
            {MONTH_NAMES[month]} {year}
          </button>
          <RoundButton icon="right" label="Next month" size="sm" onClick={() => goTo(current + 1)} />
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
          <div className="flex flex-col gap-1">
            <span>Rated at least</span>
            <RatingSlider label="Rated at least" value={minRating > 0 ? minRating : null} onChange={(v) => setMinRating(v ?? 0)} />
          </div>
        </div>
      )}

      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {!rows && !problem && <div className="skeleton h-96 rounded-2xl" />}

      {rows && (
        // One long strip of months: dragging moves the strip itself, and it settles on the nearest month when you let go.
        <div
          ref={strip}
          onScroll={onScroll}
          className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {Array.from({ length: PANELS }, (_, panel) => (
            <div key={first + panel} className="w-full shrink-0 snap-start px-4">
              {Math.abs(panel - visible) <= DRAWN ? <MonthGrid index={first + panel} byDay={byDay} picked={picked} onPick={pickDay} /> : null}
            </div>
          ))}
        </div>
      )}

      {pickedRows.length > 0 && picked && (
        <section id="picked-day" className="flex scroll-mt-4 flex-col gap-3">
          <h2 className="px-1 font-serif text-xl">{dayLabel(picked)}</h2>
          <ul className="flex flex-col gap-3">
            {pickedRows.map((group) => {
              const row = group[0];
              const poster = tmdbImageUrl(row.posterPath, "w185");
              // A show's card lists what was watched that day, one line each: "Whole series", "Season 2" or "S2 E4".
              const parts = row.category === "TV Show" ? group.map((r) => scopeLabel(r.season, r.episode)) : [];
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
                      {parts.length > 0 && (
                        <span className="flex flex-col text-neutral-700 dark:text-neutral-300">
                          {parts.map((part, i) => <span key={i}>{part}</span>)}
                        </span>
                      )}
                      <span className="text-neutral-500">{[row.venue, row.format, group.length === 1 && row.rating !== null ? `★ ${row.rating}` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pickerOpen && (
        <MonthPicker
          month={month}
          year={year}
          onClose={() => setPickerOpen(false)}
          onPick={(y, m) => {
            setPickerOpen(false);
            goTo(abs(y, m));
          }}
        />
      )}
    </main>
  );
}
