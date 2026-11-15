// lib/persistentCache.ts
// A small on-phone memory for public TMDB answers, so reopening the app does not ask for them again.
// Each entry is stored as "<time saved>|<json>"; the oldest are dropped when there are too many or the phone runs out of room.
const PREFIX = "filme-cache:";
const MAX_ENTRIES = 90;

function entries(): { key: string; at: number }[] {
  const out: { key: string; at: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const at = Number((localStorage.getItem(key) ?? "").split("|", 1)[0]);
    out.push({ key, at: Number.isFinite(at) ? at : 0 });
  }
  return out;
}

/** The saved value if it is younger than `ttl` milliseconds, otherwise undefined. */
export function readStored<T>(key: string, ttl: number): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const cut = raw.indexOf("|");
    if (cut < 0 || Date.now() - Number(raw.slice(0, cut)) > ttl) return undefined;
    return JSON.parse(raw.slice(cut + 1)) as T;
  } catch {
    return undefined;
  }
}

function evict(count: number): void {
  entries().sort((a, b) => a.at - b.at).slice(0, count).forEach((e) => localStorage.removeItem(e.key));
}

export function writeStored(key: string, value: unknown): void {
  try {
    const all = entries();
    if (all.length >= MAX_ENTRIES) evict(all.length - MAX_ENTRIES + 10);
    const text = `${Date.now()}|${JSON.stringify(value)}`;
    try {
      localStorage.setItem(PREFIX + key, text);
    } catch {
      // Out of room: drop the oldest few and try once more.
      evict(15);
      localStorage.setItem(PREFIX + key, text);
    }
  } catch {
    // Private browsing can refuse storage; the answer is simply asked for again next time.
  }
}
