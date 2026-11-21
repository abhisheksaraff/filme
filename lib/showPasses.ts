// lib/showPasses.ts
// A show's passes put together: the whole series and each season, with the completion cards of each.
import { computePasses, stacksOf, type PassViewing, type Passes, type Reset, type StackNode } from "@/lib/domain/passes";
import type { ShowData } from "@/lib/logShow";
import type { ViewingSummary } from "@/lib/ports/log";

export interface ShowPasses {
  show: Passes;
  seasons: Map<number, Passes>;
  /** Series cards first, then each season's, newest completion first. */
  stacks: StackNode[];
}

export const passViewing = (v: ViewingSummary): PassViewing => ({ id: v.id, scope: v.scope, season: v.season, episode: v.episode, date: v.watchedOn, addedAt: v.addedAt });

export function buildPasses(viewings: readonly ViewingSummary[], data: ShowData, resets: readonly Reset[], today: string): ShowPasses {
  const list = viewings.map(passViewing);
  const all = data.seasons.flatMap((s) => s.episodes.map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate })));
  const show = computePasses(list, all, resets, today, null);
  const seasons = new Map<number, Passes>();
  for (const s of data.seasons) {
    seasons.set(s.season, computePasses(list, s.episodes.map((e) => ({ season: e.season, episode: e.episode, airDate: e.airDate })), resets, today, s.season));
  }
  const stacks = [...stacksOf(show.passes, null), ...[...seasons].flatMap(([n, p]) => stacksOf(p.passes, n))];
  stacks.sort((a, b) => (b.last.date ?? "").localeCompare(a.last.date ?? "") || b.last.addedAt.localeCompare(a.last.addedAt));
  return { show, seasons, stacks };
}

/** Finds a card by its pass key, also inside series cards. */
export function findStack(stacks: readonly StackNode[], season: number | null, passKey: string): StackNode | null {
  for (const s of stacks) {
    if (s.season === season && s.passKey === passKey) return s;
    const inner = findStack(s.items.flatMap((i) => (i.type === "stack" ? [i.node] : [])), season, passKey);
    if (inner) return inner;
  }
  return null;
}
