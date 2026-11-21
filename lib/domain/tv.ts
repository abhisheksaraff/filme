// lib/domain/tv.ts
// How a TV viewing covers episodes: scope labels, what counts as watched, progress and grouping for the calendar.

/** One logged viewing, reduced to what decides which episodes it covers. */
export interface Cover {
  scope: "show" | "season" | "episode";
  season: number | null;
  episode: number | null;
  /** YYYY, YYYY-MM or YYYY-MM-DD; null when unknown. */
  date: string | null;
}

export interface EpisodeKey {
  season: number;
  episode: number;
  /** YYYY-MM-DD, or null when the episode has no air date yet. */
  airDate: string | null;
}

export function scopeOf(season: number | null, episode: number | null): Cover["scope"] {
  if (episode !== null) return "episode";
  return season !== null ? "season" : "show";
}

/** "Whole series", "Season 2" or "S2 E4". */
export function scopeLabel(season: number | null, episode: number | null): string {
  if (episode !== null) return `S${season ?? 1} E${episode}`;
  return season !== null ? `Season ${season}` : "Whole series";
}

/** The label with the show's name in front, as the Watchlist shows it: "Show · Season 2". */
export function withShow(title: string, season: number | null, episode: number | null): string {
  return season === null && episode === null ? title : `${title} · ${scopeLabel(season, episode)}`;
}

/** True when `airDate` is on or before a viewing's date; a viewing with no date covers everything. */
function airedBy(airDate: string | null, date: string | null): boolean {
  if (!date || !airDate) return true;
  return airDate.slice(0, date.length) <= date;
}

/** Whether any viewing covers the episode. A series or season viewing covers what had aired by its date. */
export function isCovered(covers: readonly Cover[], ep: EpisodeKey): boolean {
  return covers.some((c) => {
    if (c.scope === "episode") return c.season === ep.season && c.episode === ep.episode;
    if (c.scope === "season") return c.season === ep.season && airedBy(ep.airDate, c.date);
    return airedBy(ep.airDate, c.date);
  });
}

export interface Progress {
  watched: number;
  aired: number;
  /** The first aired episode not covered, in order; null when all are covered. */
  next: EpisodeKey | null;
}

/** Counts what is covered among the episodes that have aired by `today` (YYYY-MM-DD). */
export function progressOf(covers: readonly Cover[], episodes: readonly EpisodeKey[], today: string): Progress {
  const aired = episodes.filter((e) => !e.airDate || e.airDate <= today);
  let watched = 0;
  let next: EpisodeKey | null = null;
  for (const e of aired) {
    if (isCovered(covers, e)) watched++;
    else if (!next) next = e;
  }
  return { watched, aired: aired.length, next };
}

/** How many aired episodes a season has; season 0 holds the specials. */
export interface SeasonCount {
  season: number;
  episodes: number;
}

/** How far into a show you are: episodes done out of episodes aired. */
export interface Place {
  done: number;
  total: number;
}

/** Episodes aired in all, specials included. */
export const airedTotal = (aired: readonly SeasonCount[]): number => aired.reduce((n, s) => n + s.episodes, 0);

/**
 * Where the most recently added viewing leaves you, counting episodes from the start (specials first, then season by season).
 * An episode viewing puts you at that episode, a season viewing at the end of that season, a whole-series viewing at the end.
 * Only that one viewing counts, so rewatching an early episode moves you back there. Null when there is no viewing or no count.
 */
export function placeIn(latest: { scope: string; season: number | null; episode: number | null } | null, aired: readonly SeasonCount[]): Place | null {
  const total = airedTotal(aired);
  if (!latest || total === 0) return null;
  if (latest.scope === "show") return { done: total, total };
  if (latest.season === null) return null;
  const season = latest.season;
  const before = aired.filter((s) => s.season < season).reduce((n, s) => n + s.episodes, 0);
  const here = aired.find((s) => s.season === season)?.episodes ?? 0;
  const inSeason = latest.scope === "season" ? here : Math.min(latest.episode ?? here, here);
  return { done: Math.min(total, before + inSeason), total };
}

/** True while aired episodes remain after the place you are at. */
export const hasMoreAfter = (place: Place | null): place is Place => place !== null && place.done < place.total;

/** The latest viewing date among viewings, or null. Full dates only, so they compare with air dates. */
export function lastWatched(covers: readonly Cover[]): string | null {
  const dates = covers.map((c) => c.date).filter((d): d is string => !!d);
  return dates.length > 0 ? dates.sort().at(-1) ?? null : null;
}

/** An episode that aired after the last time anything of the show was watched. */
export function isNewSince(airDate: string | null, covers: readonly Cover[]): boolean {
  if (!airDate) return false;
  const last = lastWatched(covers);
  return last === null ? false : airDate.slice(0, last.length) > last;
}

/** Splits one day's viewings into cards: viewings of the same show share a card, anything else stands alone. */
export function groupByShow<T extends { mediaId: string; category: string }>(rows: readonly T[]): T[][] {
  const groups: T[][] = [];
  const byShow = new Map<string, T[]>();
  for (const row of rows) {
    if (row.category !== "TV Show") {
      groups.push([row]);
      continue;
    }
    const existing = byShow.get(row.mediaId);
    if (existing) existing.push(row);
    else {
      const group = [row];
      byShow.set(row.mediaId, group);
      groups.push(group);
    }
  }
  return groups;
}

/** Sorts viewings of a show for display: the series, then seasons, then single episodes. */
export function scopeRank(season: number | null, episode: number | null): number {
  const base = episode !== null ? 2_000_000 : season !== null ? 1_000_000 : 0;
  return base + (season ?? 0) * 1000 + (episode ?? 0);
}

/** Whether anything was watched in the twelve months before `now`. */
export function watchedWithinYear(covers: readonly Cover[], now: Date): boolean {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const limit = cutoff.toISOString().slice(0, 10);
  return covers.some((c) => !!c.date && c.date >= limit.slice(0, c.date.length));
}

/** Whether a tracked show gets new-episode news: the user's choice wins, else watched lately and still running. */
export function isFollowing(show: { mode: "on" | "off" | null; recent: boolean; running: boolean | null }): boolean {
  if (show.mode) return show.mode === "on";
  return show.recent && show.running !== false;
}
