// lib/adapters/openverse/OpenverseSearch.ts
// Looks up openly licensed pictures and music on Openverse. It needs no key; anonymous use is limited
// (about 20 searches a minute and 200 a day), so every answer is kept on the device for a month.
import { readStored, writeStored } from "@/lib/persistentCache";
import type { MediaCredit, MediaPicture, MediaSearch, MediaTrack } from "@/lib/ports/media";

const BASE = "https://api.openverse.org/v1";
const TIMEOUT_MS = 8_000;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

interface Row {
  url: string;
  title?: string | null;
  creator?: string | null;
  license: string;
  license_version?: string | null;
  duration?: number | null;
}

const creditOf = (row: Row): MediaCredit => ({
  title: row.title?.trim() || "Untitled",
  creator: row.creator?.trim() || null,
  license: `CC ${row.license.toUpperCase()}${row.license_version ? ` ${row.license_version}` : ""}`,
});

async function search(path: string, query: string, extra: string): Promise<Row[]> {
  const key = `ov:${path}:${query}:${extra}`;
  const kept = readStored<Row[]>(key, KEEP_MS);
  if (kept) {
    return kept;
  }
  try {
    const res = await fetch(`${BASE}/${path}/?q=${encodeURIComponent(query)}&page_size=12&mature=false&${extra}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as { results?: Row[] };
    const rows = (body.results ?? []).filter((r) => typeof r.url === "string" && r.url.startsWith("https://"));
    writeStored(key, rows);
    return rows;
  } catch {
    return [];
  }
}

export const openverseSearch: MediaSearch = {
  async pictures(query): Promise<MediaPicture[]> {
    const rows = await search("images", query, "extension=png&size=small,medium");
    return rows.map((r) => ({ url: r.url, credit: creditOf(r) }));
  },

  async music(query): Promise<MediaTrack[]> {
    const rows = await search("audio", query, "category=music");
    return rows
      .map((r): MediaTrack => ({ url: r.url, seconds: Math.round((r.duration ?? 0) / 1000), credit: creditOf(r) }))
      // A minute to five minutes loops without feeling abrupt and does not download a whole album.
      .filter((t) => t.seconds >= 60 && t.seconds <= 300);
  },
};
