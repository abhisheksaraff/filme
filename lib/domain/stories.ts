// lib/domain/stories.ts
// Short recaps of a day, month or year, built from the log. Nothing is stored; they are
// recalculated each time so they always match the current log.
import { MONTH_NAMES, computeStats, formatDuration, type StatRow } from "./stats";
import { formatScore } from "./score";

export type StoryKind = "day" | "month" | "year";

/** How a slide is laid out beyond its plain poster, heading and number. */
export type SlideDesign =
  /** The favourite title big, with the runners-up smaller behind it, marked #2 and #3. */
  | { type: "podium"; ranked: { title: string; posterPath: string | null }[] }
  /** A map of the venue, a mosaic of posters from there, and the other places in small text. */
  | { type: "place"; name: string; posters: string[]; others: string[] }
  /** Drawn symbols, with the other formats in small text. */
  | { type: "format"; others: string[] }
  /** A tilted, slowly scrolling grid of everything from a busy stretch. */
  | { type: "busy"; posters: string[] }
  /** Stubs and posters scattered in a spiral round the number. */
  | { type: "tickets"; posters: string[] };

export interface Slide {
  heading: string;
  big: string;
  caption: string | null;
  posterPath: string | null;
  /** The viewings this slide talks about, so their ticket stubs and photos can decorate it. */
  sessionIds?: string[];
  design?: SlideDesign;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The period a story covers for the given date: 2026-11-14, 2026-11 or 2026. */
export function periodFor(kind: StoryKind, date: Date): string {
  const year = String(date.getFullYear());
  if (kind === "year") return year;
  const month = `${year}-${pad(date.getMonth() + 1)}`;
  return kind === "month" ? month : `${month}-${pad(date.getDate())}`;
}

/** The most recent finished month or year, for the recap that appears once a period is over. */
export function previousPeriod(kind: "month" | "year", date: Date): string {
  return kind === "year"
    ? String(date.getFullYear() - 1)
    : periodFor("month", new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

/** Whether a period string has the right shape for its kind. */
export function validPeriod(kind: StoryKind, period: string): boolean {
  const shape = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ }[kind];
  return shape.test(period);
}

export function storyTitle(kind: StoryKind, period: string): string {
  if (kind === "day") return "On this day";
  if (kind === "year") return `Your ${period}`;
  return `${MONTH_NAMES[Number(period.slice(5, 7)) - 1] ?? period} ${period.slice(0, 4)}`;
}

/** Poster paths of the given viewings, each once, at most `max`. */
const postersOf = (rows: StatRow[], max: number): string[] => [...new Set(rows.map((r) => r.posterPath).filter((p): p is string => p !== null))].slice(0, max);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function daySlides(rows: StatRow[], period: string): Slide[] {
  const thisYear = Number(period.slice(0, 4));
  const monthDay = period.slice(5);
  return rows
    .filter((row) => row.watchedOn?.length === 10 && row.watchedOn.slice(5) === monthDay && Number(row.watchedOn.slice(0, 4)) < thisYear)
    .sort((a, b) => (b.watchedOn ?? "").localeCompare(a.watchedOn ?? ""))
    .map((row) => {
      const ago = thisYear - Number(row.watchedOn?.slice(0, 4));
      return {
        heading: `${plural(ago, "year")} ago today`,
        big: row.title,
        caption: [row.venue, row.format, row.rating !== null ? `★ ${formatScore(row.rating)}` : null].filter(Boolean).join(" · ") || null,
        posterPath: row.posterPath,
        sessionIds: [row.id],
      };
    });
}

function periodSlides(all: StatRow[], kind: "month" | "year", period: string): Slide[] {
  const rows = all.filter((row) => row.watchedOn?.startsWith(period));
  if (rows.length === 0) return [];
  const stats = computeStats(rows, null);
  const posterOf = (title: string) => rows.find((row) => row.title === title)?.posterPath ?? null;

  const slides: Slide[] = [
    {
      heading: storyTitle(kind, period),
      big: plural(stats.viewings, "viewing"),
      caption: `${plural(stats.titles, "title")} · ${formatDuration(stats.minutes)}`,
      posterPath: null,
      sessionIds: rows.map((row) => row.id),
      // The most watched titles, if any have a poster; otherwise the slide stays plain.
      design: stats.topTitles.some((t) => posterOf(t.label))
        ? { type: "podium", ranked: stats.topTitles.slice(0, 3).map((t) => ({ title: t.label, posterPath: posterOf(t.label) })) }
        : undefined,
    },
  ];

  const rated = rows.filter((row) => row.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const best = rated[0];
  if (best) {
    // The three best-rated titles, each once.
    const ranked = rated.filter((row, i) => rated.findIndex((r) => r.title === row.title) === i).slice(0, 3);
    slides.push({
      heading: "Your top rated",
      big: best.title,
      caption: `★ ${formatScore(best.rating ?? 0)}`,
      posterPath: best.posterPath,
      sessionIds: [best.id],
      design: { type: "podium", ranked: ranked.map((row) => ({ title: row.title, posterPath: row.posterPath })) },
    });
  }

  const again = stats.topTitles[0];
  if (again && again.value > 1) {
    slides.push({ heading: "Watched the most", big: again.label, caption: `${again.value} times`, posterPath: posterOf(again.label), sessionIds: rows.filter((row) => row.title === again.label).map((row) => row.id), design: { type: "podium", ranked: stats.topTitles.slice(0, 3).map((t) => ({ title: t.label, posterPath: posterOf(t.label) })) } });
  }

  if (stats.venues[0]) {
    const there = rows.filter((row) => row.venue === stats.venues[0].label);
    slides.push({
      heading: "Favourite place",
      big: stats.venues[0].label,
      caption: plural(stats.venues[0].value, "visit"),
      posterPath: null,
      sessionIds: there.map((row) => row.id),
      design: { type: "place", name: stats.venues[0].label, posters: postersOf(there, 6), others: stats.venues.slice(1, 4).map((v) => v.label) },
    });
  }
  if (stats.formats[0]) {
    slides.push({
      heading: "Favourite format",
      big: stats.formats[0].label,
      caption: plural(stats.formats[0].value, "viewing"),
      posterPath: null,
      sessionIds: rows.filter((row) => row.format === stats.formats[0].label).map((row) => row.id),
      design: { type: "format", others: stats.formats.slice(1, 4).map((f) => f.label) },
    });
  }

  if (kind === "year") {
    const busiest = [...stats.months].sort((a, b) => b.value - a.value)[0];
    if (busiest && busiest.value > 0) {
      const name = MONTH_NAMES.find((m) => m.startsWith(busiest.label)) ?? busiest.label;
      const inMonth = rows.filter((row) => row.watchedOn?.slice(5, 7) === String(MONTH_NAMES.findIndex((m) => m === name) + 1).padStart(2, "0"));
      slides.push({ heading: "Busiest month", big: name, caption: plural(busiest.value, "viewing"), posterPath: null, sessionIds: inMonth.map((row) => row.id), design: { type: "busy", posters: postersOf(inMonth, 12) } });
    }
  }

  if (stats.tickets > 0) {
    const withTickets = rows.filter((row) => (row.tickets ?? 0) > 0);
    slides.push({ heading: "Tickets", big: String(stats.tickets), caption: "collected", posterPath: null, sessionIds: withTickets.map((row) => row.id), design: { type: "tickets", posters: postersOf(withTickets, 8) } });
  }
  return slides;
}

/** The slides for one story; empty when the log has nothing for that period. */
export function buildStory(rows: StatRow[], kind: StoryKind, period: string): Slide[] {
  return kind === "day" ? daySlides(rows, period) : periodSlides(rows, kind, period);
}

