// lib/importCsv.ts
// Brings in a history exported from Letterboxd or Trakt: each row is matched to a TMDB title
// by name and year, then saved as a viewing.
import { mediaFromCatalog } from "@/components/entryDraft";
import { logEntrySchema } from "@/lib/domain/entry";
import { syncCredits } from "@/lib/credits";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const MAX_ROWS = 400;

/** Splits CSV text into rows of cells, handling quoted cells with commas and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

interface Item {
  title: string;
  year: string | null;
  date: string | null;
  rating: number | null;
  show: boolean;
  season: number | null;
  episode: number | null;
}

/** Reads rows by header name so both services' column layouts work. */
function toItems(rows: string[][]): Item[] {
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iTitle = col("name", "title");
  const iYear = col("year");
  const iDate = col("watched date", "watched_at", "date");
  const iRating = col("rating");
  const iType = col("type");
  const iSeason = col("season");
  const iEpisode = col("episode");
  if (iTitle < 0) return [];

  const raw = rows.slice(1).map((r) => ({ r, rating: iRating >= 0 ? Number(r[iRating]) : NaN }));
  // Letterboxd rates out of 5, Trakt out of 10; the largest rating in the file tells which.
  const outOfFive = Math.max(0, ...raw.map((x) => (Number.isFinite(x.rating) ? x.rating : 0))) <= 5;
  return raw.slice(0, MAX_ROWS).map(({ r, rating }) => {
    const date = iDate >= 0 ? (/^\d{4}-\d{2}-\d{2}/.exec(r[iDate] ?? "")?.[0] ?? null) : null;
    const scaled = Number.isFinite(rating) && rating > 0 ? Math.min(10, Math.max(1, outOfFive ? rating * 2 : rating)) : null;
    const show = iType >= 0 && (r[iType] ?? "").toLowerCase() !== "movie";
    return {
      title: (r[iTitle] ?? "").trim(),
      year: iYear >= 0 ? (r[iYear]?.trim() || null) : null,
      date,
      rating: scaled,
      show,
      season: iSeason >= 0 && r[iSeason] ? Number(r[iSeason]) : null,
      episode: iEpisode >= 0 && r[iEpisode] ? Number(r[iEpisode]) : null,
    };
  }).filter((item) => item.title !== "");
}

/** Imports the file one row at a time; returns how many were saved and how many could not be matched. */
export async function importCsv(file: File, onProgress: (done: number, total: number) => void): Promise<Result<{ saved: number; skipped: number }>> {
  const items = toItems(parseCsv(await file.text()));
  if (items.length === 0) return fail("That file has no rows I can read. I look for a Name or Title column.");

  let saved = 0;
  let skipped = 0;
  for (const [i, item] of items.entries()) {
    onProgress(i, items.length);
    const kind = item.show ? "TV Show" : "Movie";
    const hits = await services.catalog.search(item.title, kind);
    const hit = hits.ok ? (hits.value.find((h) => !item.year || h.year === item.year) ?? hits.value[0]) : undefined;
    if (!hit) { skipped++; continue; }
    const details = await services.catalog.details({ kind, tmdbId: hit.tmdbId });
    if (!details.ok) { skipped++; continue; }
    const entry = logEntrySchema.safeParse({
      category: kind, title: details.value.title, season: item.season, episode: item.episode, episodeTitle: null,
      location: null, address: null, auditorium: null, date: item.date, time: null, seats: [], totalTickets: null,
      primaryFormat: null, addons: [], rating: item.rating, notes: null, media: mediaFromCatalog(details.value),
    });
    if (!entry.success) { skipped++; continue; }
    const res = await services.log.saveEntry(entry.data, []);
    if (res.ok) {
      saved++;
      void syncCredits(res.value.mediaId, kind, hit.tmdbId);
    } else skipped++;
  }
  onProgress(items.length, items.length);
  return ok({ saved, skipped });
}
