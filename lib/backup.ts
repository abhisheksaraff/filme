// lib/backup.ts
// Downloading and syncing the log: a data file, image ZIPs, and CSVs for Letterboxd and Trakt.
// Everything runs in the browser against the user's own rows.
import { ok, fail, type Result } from "@/lib/ports/result";
import type { ExportBundle } from "@/lib/ports/data";
import { activeStore, storeFor } from "@/lib/files";
import { services } from "@/lib/services";
import { readZip, createZip, type ZipFile } from "@/lib/zip";

const encoder = new TextEncoder();

/** Image ZIPs are split so no single part grows too big for a phone's memory. */
const PART_BYTES = 150_000_000;

const isCover = (kind: string) => kind === "poster" || kind === "backdrop";
const mimeOf = (path: string) => (/\.png$/.test(path) ? "image/png" : /\.webp$/.test(path) ? "image/webp" : "image/jpeg");
const extOf = (path: string) => path.split(".").pop() ?? "bin";

interface ManifestItem {
  id: string;
  kind: string;
  path: string;
}

/** Everything except pictures, as one JSON file that can be uploaded again anywhere. */
export async function downloadData(): Promise<Result<Blob>> {
  const bundle = await services.data.exportTables();
  if (!bundle.ok) return bundle;
  await services.settings.markBackup();
  return ok(new Blob([JSON.stringify(bundle.value, null, 2)], { type: "application/json" }));
}

/**
 * Syncs a data file into this account: rows that are missing are added, rows already here are kept,
 * and when both exist the newer copy wins. Running it twice changes nothing.
 */
export async function uploadData(file: File): Promise<Result<string>> {
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(await file.text()) as ExportBundle;
  } catch {
    return fail("That file could not be read.");
  }
  if (bundle?.version !== 1 || typeof bundle.tables !== "object") return fail("That is not a filmè data file.");
  const res = await services.data.importTables(bundle);
  return res.ok ? ok(`Synced ${res.value} rows.`) : res;
}

/** Every uploaded picture as ZIP parts, each with a manifest saying which image each file is. */
export async function downloadImages(onProgress: (done: number, total: number) => void): Promise<Result<{ parts: Blob[]; missing: number }>> {
  const rows = await services.data.imageRows();
  if (!rows.ok) return rows;

  const parts: Blob[] = [];
  let files: ZipFile[] = [];
  let manifest: ManifestItem[] = [];
  let bytes = 0;
  let missing = 0;
  const flush = () => {
    if (files.length === 0) return;
    parts.push(createZip([{ name: "manifest.json", data: encoder.encode(JSON.stringify({ version: 1, images: manifest })) }, ...files]));
    files = [];
    manifest = [];
    bytes = 0;
  };

  for (const [i, row] of rows.value.entries()) {
    const blob = isCover(row.kind) ? await services.data.readCover(row.path) : await storeFor(row.store).get(row.path);
    if (blob.ok) {
      files.push({ name: `images/${row.id}.${extOf(row.path)}`, data: new Uint8Array(await blob.value.arrayBuffer()) });
      manifest.push({ id: row.id, kind: row.kind, path: row.path });
      bytes += blob.value.size;
      if (bytes >= PART_BYTES) flush();
    } else missing++;
    onProgress(i + 1, rows.value.length);
  }
  flush();
  return ok({ parts, missing });
}

/**
 * Puts pictures from image ZIPs into the current store. Pictures already there are left alone, and
 * each one is matched to its viewing by id, so upload the data file first on a new account.
 */
export async function uploadImages(zips: File[], onProgress: (done: number, total: number) => void): Promise<Result<string>> {
  const rows = await services.data.imageRows();
  if (!rows.ok) return rows;
  const known = new Map(rows.value.map((row) => [row.id, row]));

  let done = 0;
  let uploaded = 0;
  let already = 0;
  let unmatched = 0;
  for (const zip of zips) {
    const entries = await readZip(zip);
    const manifestFile = entries?.find((f) => f.name === "manifest.json");
    if (!entries || !manifestFile) return fail(`${zip.name} is not a filmè image file.`);
    const manifest = (JSON.parse(new TextDecoder().decode(manifestFile.data)) as { images: ManifestItem[] }).images;
    const total = manifest.length;

    for (const item of manifest) {
      onProgress(++done, Math.max(done, total));
      const row = known.get(item.id);
      const data = entries.find((f) => f.name === `images/${item.id}.${extOf(item.path)}`);
      if (!row || !data) {
        unmatched++;
        continue;
      }
      const blob = new Blob([data.data as Uint8Array<ArrayBuffer>], { type: mimeOf(item.path) });
      if (isCover(row.kind)) {
        const up = await services.data.writeCover(row.path, blob);
        if (up.ok) uploaded++;
        continue;
      }
      const there = await activeStore.get(row.path);
      if (there.ok && there.value.size === blob.size) already++;
      else if (!(await activeStore.put(row.path, blob)).ok) continue;
      else uploaded++;
      if (row.store !== activeStore.id) await services.data.setImageStore(row.id, activeStore.id);
    }
  }
  const parts = [`Uploaded ${uploaded}`, `${already} already there`];
  if (unmatched > 0) parts.push(`${unmatched} belong to viewings that are not in your log yet (upload your data first)`);
  return ok(`${parts.join(", ")}.`);
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");

/** Letterboxd's importer reads Date, Name, Year, Rating (0.5 to 5) and Rewatch. Movies only. */
export async function exportLetterboxd(): Promise<Result<Blob>> {
  const bundle = await services.data.exportTables();
  if (!bundle.ok) return bundle;
  const media = new Map((bundle.value.tables.media_items ?? []).map((m) => [m.id as string, m]));
  const seen = new Set<string>();
  const rows = [...(bundle.value.tables.watch_sessions ?? [])]
    .filter((s) => !s.deleted_at && String(s.watched_on ?? "").length === 10)
    .sort((a, b) => String(a.watched_on).localeCompare(String(b.watched_on)))
    .flatMap((s) => {
      const m = media.get(s.media_id as string);
      if (!m || m.category !== "Movie") return [];
      const rewatch = seen.has(m.id as string);
      seen.add(m.id as string);
      return [[s.watched_on, m.title, String(m.release_date ?? "").slice(0, 4), s.rating === null ? "" : Number(s.rating) / 2, rewatch ? "true" : "", m.tmdb_id ?? ""]];
    });
  return ok(new Blob([csv(["Date", "Name", "Year", "Rating", "Rewatch", "tmdbID"], rows)], { type: "text/csv" }));
}

/** A plain history file Trakt-style tools can map: watched_at, type, title, year, tmdb_id, rating. */
export async function exportTrakt(): Promise<Result<Blob>> {
  const bundle = await services.data.exportTables();
  if (!bundle.ok) return bundle;
  const media = new Map((bundle.value.tables.media_items ?? []).map((m) => [m.id as string, m]));
  const rows = (bundle.value.tables.watch_sessions ?? [])
    .filter((s) => !s.deleted_at)
    .flatMap((s) => {
      const m = media.get(s.media_id as string);
      if (!m || (m.category !== "Movie" && m.category !== "TV Show")) return [];
      return [[s.watched_on ?? "", m.category === "Movie" ? "movie" : "episode", m.title, String(m.release_date ?? "").slice(0, 4), m.tmdb_id ?? "", s.season_number ?? "", s.episode_number ?? "", s.rating ?? ""]];
    });
  return ok(new Blob([csv(["watched_at", "type", "title", "year", "tmdb_id", "season", "episode", "rating"], rows)], { type: "text/csv" }));
}
