// lib/domain/passes.ts
// Watching a show or season through, again and again: which episodes count toward the current pass, when a pass is complete,
// and the completion cards ("stacks") built from episode-by-episode viewings.
import type { EpisodeKey } from "@/lib/domain/tv";

/** One viewing, reduced to what decides which episodes it covers. */
export interface PassViewing {
  id: string;
  scope: "show" | "season" | "episode";
  season: number | null;
  episode: number | null;
  /** YYYY, YYYY-MM or YYYY-MM-DD; null when unknown. */
  date: string | null;
  /** When it was added (the server's time). */
  addedAt: string;
}

/** An episode seen, and the viewing it came from. */
export interface PassEvent {
  viewingId: string;
  scope: PassViewing["scope"];
  season: number;
  episode: number;
  date: string | null;
  addedAt: string;
}

/** "Reset this rewatch" pressed at `at`; season null is the whole series. */
export interface Reset {
  season: number | null;
  at: string;
}

/** A completed run through every episode. */
export interface Pass {
  index: number;
  /** The episodes seen, oldest first, repeats kept. */
  events: PassEvent[];
  /** True when one viewing logged the whole season or series: no stack then. */
  whole: boolean;
  last: PassEvent;
}

export interface Passes {
  passes: Pass[];
  /** Distinct episodes seen in the current pass, out of the episodes aired. */
  seen: number;
  total: number;
  /** The current pass's episodes so far. */
  events: PassEvent[];
}

const key = (season: number, episode: number) => `${season}:${episode}`;

/** True when an episode had aired by a viewing's date; no date on either side counts as yes. */
function airedBy(airDate: string | null, date: string | null): boolean {
  if (!date || !airDate) return true;
  return airDate.slice(0, date.length) <= date;
}

const byTime = (a: PassEvent, b: PassEvent) =>
  (a.date ?? "").localeCompare(b.date ?? "") || a.addedAt.localeCompare(b.addedAt) || a.season - b.season || a.episode - b.episode;

/**
 * Works out the passes for a season (`season` given, `episodes` are its episodes) or the whole series (`season` null).
 * A pass is complete once every episode that had aired by the day of its last viewing has been seen in it, in any order.
 * An episode logged again in the same pass is kept in its list but counts once. A reset empties the pass in progress.
 * When a new episode airs, the last complete pass is reopened (it is no longer complete).
 */
export function computePasses(viewings: readonly PassViewing[], episodes: readonly EpisodeKey[], resets: readonly Reset[], today: string, season: number | null): Passes {
  const aired = episodes.filter((e) => !e.airDate || e.airDate <= today);
  const events: PassEvent[] = [];
  for (const v of viewings) {
    if (season !== null && v.scope !== "show" && v.season !== season) continue;
    const base = { viewingId: v.id, scope: v.scope, date: v.date, addedAt: v.addedAt };
    if (v.scope === "episode") {
      if (v.season !== null && v.episode !== null && aired.some((e) => e.season === v.season && e.episode === v.episode)) events.push({ ...base, season: v.season, episode: v.episode });
    } else {
      for (const e of aired) {
        if ((v.scope === "show" || e.season === v.season) && airedBy(e.airDate, v.date)) events.push({ ...base, season: e.season, episode: e.episode });
      }
    }
  }
  events.sort(byTime);

  const mine = resets.filter((r) => r.season === season).map((r) => r.at).sort();
  const passes: Pass[] = [];
  let cur: PassEvent[] = [];
  let have = new Set<string>();
  let nextReset = 0;
  for (const ev of events) {
    let cleared = false;
    while (nextReset < mine.length && mine[nextReset] < ev.addedAt) {
      nextReset++;
      cleared = true;
    }
    if (cleared) {
      cur = [];
      have = new Set();
    }
    cur.push(ev);
    have.add(key(ev.season, ev.episode));
    const required = aired.filter((e) => airedBy(e.airDate, ev.date));
    if (required.length > 0 && required.every((e) => have.has(key(e.season, e.episode)))) {
      // Finished by one viewing alone (the whole series or a whole season logged at once): there is nothing to stack.
      passes.push({ index: passes.length, events: cur, whole: new Set(cur.map((e) => e.viewingId)).size === 1 && ev.scope !== "episode", last: ev });
      cur = [];
      have = new Set();
    }
  }
  if (nextReset < mine.length) {
    cur = [];
    have = new Set();
  }

  // An episode that aired after the last complete pass reopens it, unless the rewatch was reset since.
  const last = passes.at(-1);
  if (last && cur.length === 0 && !mine.some((at) => at > last.last.addedAt)) {
    const set = new Set(last.events.map((e) => key(e.season, e.episode)));
    if (aired.some((e) => !set.has(key(e.season, e.episode)))) {
      passes.pop();
      cur = last.events;
      have = set;
    }
  }
  return { passes, seen: have.size, total: aired.length, events: cur };
}

/** What a season poster, header or progress line shows. */
export type SeenState = { kind: "none" } | { kind: "ring"; progress: number; rewatch: number } | { kind: "eye" };

export function seenState(p: Passes): SeenState {
  if (p.seen > 0 && p.total > 0) return { kind: "ring", progress: p.seen / p.total, rewatch: p.passes.length };
  return p.passes.length > 0 ? { kind: "eye" } : { kind: "none" };
}

/** A completion card: a pass finished episode by episode. Its items are viewings, or (for a series) season cards. */
export interface StackNode {
  /** Unique within the page. */
  id: string;
  /** Null for a series. */
  season: number | null;
  /** The first viewing in the pass; what an edit to this card is saved against. */
  passKey: string;
  /** The last episode seen, whose details the card mirrors. */
  last: PassEvent;
  items: StackItem[];
  /** A season card inside a series card is edited like any season card; they share edits when they are the same pass. */
  editable: boolean;
}
export type StackItem = { type: "viewing"; viewingId: string } | { type: "stack"; node: StackNode };

/** Every distinct viewing in a pass, in order; an episode watched again is another viewing, so it stays. */
const viewingItems = (events: readonly PassEvent[]): StackItem[] => {
  const seen = new Set<string>();
  const items: StackItem[] = [];
  for (const e of events) {
    if (seen.has(e.viewingId)) continue;
    seen.add(e.viewingId);
    items.push({ type: "viewing", viewingId: e.viewingId });
  }
  return items;
};

/** The completion cards of a season (`season` given) or the series (null), none for passes finished by logging the whole thing. */
export function stacksOf(passes: readonly Pass[], season: number | null): StackNode[] {
  const out: StackNode[] = [];
  for (const pass of passes) {
    if (pass.whole) continue;
    const first = pass.events[0].viewingId;
    const id = `${season ?? "show"}-${first}`;
    if (season !== null) {
      out.push({ id, season, passKey: first, last: pass.last, items: viewingItems(pass.events), editable: true });
      continue;
    }
    // A series card holds one card per season; a season logged whole inside it stays a single viewing.
    const seasons = [...new Set(pass.events.map((e) => e.season))].sort((a, b) => a - b);
    const items: StackItem[] = [];
    for (const s of seasons) {
      const group = pass.events.filter((e) => e.season === s);
      const eps = group.filter((e) => e.scope === "episode");
      if (eps.length === 0) {
        const whole = group[group.length - 1].viewingId;
        if (!items.some((i) => i.type === "viewing" && i.viewingId === whole)) items.push({ type: "viewing", viewingId: whole });
      } else {
        items.push({ type: "stack", node: { id: `${id}-s${s}`, season: s, passKey: eps[0].viewingId, last: eps[eps.length - 1], items: viewingItems(eps), editable: true } });
      }
    }
    out.push({ id, season: null, passKey: first, last: pass.last, items, editable: true });
  }
  return out;
}

/** Every episode viewing in a stack, with the ones nested in season cards, for deleting a pass. */
export function viewingIdsOf(node: StackNode): string[] {
  return node.items.flatMap((i) => (i.type === "viewing" ? [i.viewingId] : viewingIdsOf(i.node)));
}
