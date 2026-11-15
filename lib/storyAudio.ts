// lib/storyAudio.ts
// Story music, kept on the phone. A track is downloaded in full ahead of time and stored, so a story plays from its own
// copy instead of streaming from a music site while it opens. If a site does not allow the download, the track is
// streamed as before. The ready track is handed to the player once and dropped when the story closes.
import { debugLog } from "@/lib/debug";
import type { MediaTrack } from "@/lib/ports/media";

interface Ready {
  track: MediaTrack;
  el: HTMLAudioElement;
}

let ready: Ready | null = null;
/** Phones often do not download audio until it is played, so waiting is limited; a slow track is still used. */
const WAIT_MS = 8000;
const STORE = "filme-music";
/** Tracks kept on the phone; the oldest go first when a new story's track is saved. */
const KEEP = 6;

const hasStore = () => typeof caches !== "undefined";

/** Downloads a track and keeps it on the phone. False when the music site does not allow it or the download fails. */
async function saveTrack(track: MediaTrack): Promise<boolean> {
  if (!hasStore()) return false;
  try {
    const store = await caches.open(STORE);
    if (await store.match(track.url)) return true;
    const res = await fetch(track.url, { mode: "cors" });
    if (!res.ok) return false;
    await store.put(track.url, res);
    // Only the newest few stay, so the music cannot slowly fill the phone.
    const kept = await store.keys();
    for (const old of kept.slice(0, Math.max(0, kept.length - KEEP))) await store.delete(old);
    return true;
  } catch {
    return false;
  }
}

/** The phone's own copy of a track as a playable address, or null when there is none. */
async function savedUrl(track: MediaTrack): Promise<string | null> {
  if (!hasStore()) return null;
  try {
    const hit = await (await caches.open(STORE)).match(track.url);
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}

/** Saves the first track that can be downloaded and returns the list with it first; unchanged if none could be. */
export async function saveFirstTrack(tracks: MediaTrack[]): Promise<MediaTrack[]> {
  for (const [i, track] of tracks.entries()) {
    if (await saveTrack(track)) {
      debugLog(`music saved on the phone (${new URL(track.url).host})`);
      return [track, ...tracks.filter((_, j) => j !== i)];
    }
  }
  return tracks;
}

export function clearPreloaded(): void {
  ready = null;
}

/** Loads the first track that can be read (from the phone's copy if there is one); tracks that fail are skipped. */
export async function preloadTrack(tracks: MediaTrack[]): Promise<void> {
  clearPreloaded();
  for (const track of tracks) {
    // A copy on the phone, else try to save one now, else stream the original.
    const local = (await savedUrl(track)) ?? ((await saveTrack(track)) ? await savedUrl(track) : null);
    const el = new Audio();
    // Same rule as playback: without the server's permission the sound would be silenced, so the track counts as failed.
    el.crossOrigin = "anonymous";
    el.loop = true;
    el.preload = "auto";
    const outcome = await new Promise<"loaded" | "slow" | "error">((resolve) => {
      const finish = (value: "loaded" | "slow" | "error") => {
        clearTimeout(timer);
        el.oncanplaythrough = null;
        el.onerror = null;
        resolve(value);
      };
      const timer = setTimeout(() => finish("slow"), WAIT_MS);
      el.oncanplaythrough = () => finish("loaded");
      el.onerror = () => finish("error");
      el.src = local ?? track.url;
      el.load();
    });
    debugLog(`track preload: ${outcome} (${local ? "from the phone" : new URL(track.url).host})`);
    if (outcome !== "error") {
      ready = { track, el };
      return;
    }
  }
}

/** The preloaded track and its element if it is one of `tracks`; handed over once. */
export function takePreloaded(tracks: MediaTrack[]): Ready | null {
  const taken = ready && tracks.some((t) => t.url === ready?.track.url) ? ready : null;
  ready = null;
  return taken;
}
