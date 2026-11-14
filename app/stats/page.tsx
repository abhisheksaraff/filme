// app/stats/page.tsx
// Totals and charts over everything you have logged, for all time or one year.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import BarList from "@/components/BarList";
import { useRequireSession } from "@/hooks/useRequireSession";
import { computeStats, formatDuration, statYears, type StatRow } from "@/lib/domain/stats";
import { languageName, loadStatRows } from "@/lib/home/rows";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-300 p-3 dark:border-neutral-700">
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-xl">{title}</h2>
      {children}
    </section>
  );
}

export default function StatsPage() {
  const ready = useRequireSession();
  const [rows, setRows] = useState<StatRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  if (!ready) return null;

  const years = rows ? statYears(rows) : [];
  // A custom range overrides the year chips.
  const custom = from !== "" || to !== "";
  const stats = rows ? computeStats(rows, custom ? null : year, custom ? { from: from || null, to: to || null } : undefined) : null;
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-[var(--accent,#171717)] font-medium" : "border-neutral-300 dark:border-neutral-700"}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8">
      <BackLink fallback="/profile/" />
      <h1 className="font-serif text-3xl tracking-tight">Stats</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {!rows && !problem && <div className="skeleton h-64 rounded-2xl" />}

      {rows && stats && (
        <>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6">
            <button type="button" className={chip(year === null && !custom)} onClick={() => { setYear(null); setFrom(""); setTo(""); }}>All time</button>
            {years.map((y) => (
              <button key={y} type="button" className={chip(year === y && !custom)} onClick={() => { setYear(y); setFrom(""); setTo(""); }}>{y}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
            <span className="text-neutral-500">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700" />
          </div>

          {stats.viewings === 0 ? (
            <p className="text-sm text-neutral-500">Nothing logged for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Viewings" value={String(stats.viewings)} />
                <Tile label="Titles" value={String(stats.titles)} />
                <Tile label="Watch time" value={stats.minutes > 0 ? formatDuration(stats.minutes) : "—"} />
                <Tile label="Tickets" value={stats.tickets > 0 ? String(stats.tickets) : "—"} />
                <Tile label="Avg rating" value={stats.averageRating === null ? "—" : stats.averageRating.toFixed(1)} />
                <Tile label="Rewatches" value={String(stats.rewatches)} />
                <Tile label="Venues" value={stats.uniqueVenues > 0 ? String(stats.uniqueVenues) : "—"} />
              </div>

              {year === null && !custom ? (
                <Section title="By year"><BarList items={stats.years} /></Section>
              ) : (
                <Section title="By month"><BarList items={stats.months} /></Section>
              )}
              <Section title="Day of the week"><BarList items={stats.weekdays} /></Section>
              {stats.ratings.some((r) => r.value > 0) && <Section title="Ratings"><BarList items={stats.ratings} /></Section>}
              {stats.topTitles.length > 0 && <Section title="Watched most"><BarList items={stats.topTitles} /></Section>}
              {stats.venues.length > 0 && <Section title="Places"><BarList items={stats.venues} /></Section>}
              {stats.formats.length > 0 && <Section title="Formats"><BarList items={stats.formats} /></Section>}
              {stats.formatRatings.length > 0 && <Section title="Best-rated formats"><BarList items={stats.formatRatings} decimals={1} /></Section>}
              {stats.genres.length > 0 && <Section title="Genres"><BarList items={stats.genres} /></Section>}
              {stats.directors.length > 0 && <Section title="Directors"><BarList items={stats.directors} /></Section>}
              {stats.actors.length > 0 && <Section title="Actors"><BarList items={stats.actors} /></Section>}
              {stats.bestActors.length > 0 && <Section title="Highest-rated actors"><BarList items={stats.bestActors} decimals={1} /></Section>}
              {stats.performers.length > 0 && <Section title="Artists seen live"><BarList items={stats.performers} /></Section>}
              <Link href="/globe/" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700">See your venues on the globe →</Link>
              {stats.categories.length > 0 && <Section title="Types"><BarList items={stats.categories} /></Section>}
              {stats.languages.length > 0 && (
                <Section title="Languages">
                  <BarList items={stats.languages.map((l) => ({ label: languageName(l.label), value: l.value }))} />
                </Section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
