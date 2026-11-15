// lib/storyAudio.ts
// Downloads a story's music before the story opens, so the first tap starts it at once. The ready track is handed
// to the player once and dropped when the story closes; the next story downloads its own.
import { debugLog } from "@/lib/debug";
import type { MediaTrack } from "@/lib/ports/media";

interface Ready {
  track: MediaTrack;
  el: HTMLAudioElement;
}

let ready: Ready | null = null;
/** Phones often do not download audio until it is played, so waiting is limited; a slow track is still used. */
const WAIT_MS = 8000;

export function clearPreloaded(): void {
  ready = null;
}

/** Loads the first track that can be read; tracks that fail are skipped. Nothing is kept if none can. */
export async function preloadTrack(tracks: MediaTrack[]): Promise<void> {
  clearPreloaded();
  for (const track of tracks) {
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
      el.src = track.url;
      el.load();
    });
    debugLog(`track preload: ${outcome} (${new URL(track.url).host})`);
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
