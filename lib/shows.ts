// lib/shows.ts
// The once-a-day look at shows you follow: finds each one's latest aired episode, saves it, and raises a notification
// when something new has aired since you last watched.
import { isCovered, isFollowing, isNewSince } from "@/lib/domain/tv";
import type { TrackedShow } from "@/lib/ports/follows";
import { services } from "@/lib/services";

const CHECKED_KEY = "filme_shows_checked";
/** Shows looked up per run, so a long watch history cannot use up the day's TMDB calls. */
const MAX_SHOWS = 30;
/** A new episode only raises a notification while it is this recent. */
const NEWS_DAYS = 14;

const today = () => new Date().toISOString().slice(0, 10);

let running: Promise<void> | null = null;

/** Whether the latest aired episode is one the user has not watched. */
export function hasUnseenAired(show: TrackedShow): boolean {
  return !!show.aired && !isCovered(show.covers, { season: show.aired.season, episode: show.aired.episode, airDate: show.aired.airDate });
}

/** Shows with an unwatched episode that aired after the last thing watched, among those followed. */
export function withNewEpisodes(shows: readonly TrackedShow[]): TrackedShow[] {
  return shows.filter((s) => isFollowing(s) && hasUnseenAired(s) && isNewSince(s.aired?.airDate ?? null, s.covers));
}

/**
 * Shows that may belong in Continue watching, before episodes are counted: the user has not switched the show off or taken it off
 * Home since the last viewing, and it is followed or not just newly aired (a show finished long ago does not come back for a new
 * season unless it is followed). Whether aired episodes remain after where you are is decided with the episode counts.
 */
export function continueCandidates(shows: readonly TrackedShow[]): TrackedShow[] {
  return shows
    .filter((s) => {
      if (s.mode === "off" || !s.latest) return false;
      if (s.removedAfter && Date.parse(s.latest.addedAt) <= Date.parse(s.removedAfter)) return false;
      return isFollowing(s) || !isNewSince(s.aired?.airDate ?? null, s.covers);
    })
    .sort((a, b) => Date.parse(b.latest?.addedAt ?? "") - Date.parse(a.latest?.addedAt ?? ""));
}

/** Runs the check once a day; calling it again meanwhile waits for the same run. Failures are quiet. */
export function checkNewEpisodes(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      if (localStorage.getItem(CHECKED_KEY) === today()) return;
      const tracked = await services.follows.tracked();
      if (!tracked.ok) return;

      const due = tracked.value.filter((s) => s.mode !== "off" && s.checkedOn !== today()).slice(0, MAX_SHOWS);
      for (let i = 0; i < due.length; i += 5) {
        await Promise.all(
          due.slice(i, i + 5).map(async (show) => {
            const status = await services.catalog.showStatus(show.tmdbId);
            if (!status.ok) return;
            const last = status.value.last;
            show.running = status.value.running;
            show.aired = last ? { season: last.season, episode: last.episode, airDate: last.airDate, name: last.name } : null;
            show.checkedOn = today();
            await services.follows.saveCheck(show.mediaId, { running: show.running, aired: show.aired, checkedOn: show.checkedOn });
          }),
        );
      }

      const cutoff = new Date(Date.now() - NEWS_DAYS * 86_400_000).toISOString().slice(0, 10);
      for (const show of withNewEpisodes(tracked.value)) {
        if (!show.aired?.airDate || show.aired.airDate < cutoff) continue;
        // "|" separates the parts, so the show's own name goes last.
        await services.notifications.ensure("new-episode", `${show.mediaId}|S${show.aired.season}E${show.aired.episode}|${show.title}`);
      }
      localStorage.setItem(CHECKED_KEY, today());
    } catch {
      // Nothing here is worth interrupting the user; the next open tries again.
    }
  })();
  return running;
}
