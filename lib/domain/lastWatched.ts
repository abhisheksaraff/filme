// lib/domain/lastWatched.ts
// The small grey "Last watched …" line under a description.
import { scopeLabel } from "./tv";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 15, 2024", or "Oct 2024" or "2024" when only that much was logged. */
export function formatWatchedDate(date: string): string {
  const [y, m, d] = date.split("-");
  if (!m) return y;
  const month = MONTHS[Number(m) - 1] ?? m;
  return d ? `${month} ${Number(d)}, ${y}` : `${month} ${y}`;
}

export interface LastViewing {
  watchedOn: string | null;
  scope: "show" | "season" | "episode";
  season: number | null;
  episode: number | null;
}

/** The most recent dated viewing; null when nothing has a date. */
export function latestViewing<T extends LastViewing>(viewings: readonly T[]): T | null {
  const dated = viewings.filter((v) => v.watchedOn);
  if (dated.length === 0) return null;
  return dated.reduce((best, v) => ((v.watchedOn as string) > (best.watchedOn as string) ? v : best));
}

/** "Last watched Oct 15, 2024", with what was watched for a show: "Last watched Oct 15, 2024 · S2 E4". */
export function lastWatchedText(viewing: LastViewing | null, isShow: boolean): string | null {
  if (!viewing?.watchedOn) return null;
  const when = formatWatchedDate(viewing.watchedOn);
  if (!isShow) return `Last watched ${when}`;
  const what = viewing.scope === "show" ? "whole series" : scopeLabel(viewing.season, viewing.episode);
  return `Last watched ${when} · ${what}`;
}
