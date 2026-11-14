// lib/backup.ts
// Export and import of the whole log: a ZIP with the data and images, a JSON file, or CSVs for
// Letterboxd and Trakt. Everything runs in the browser against the user's own rows.
import { ok, fail, type Result } from "@/lib/ports/result";
import type { ExportBundle } from "@/lib/ports/data";
import { services } from "@/lib/services";
import { readZip, createZip, type ZipFile } from "@/lib/zip";

const encoder = new TextEncoder();

type Row = Record<string, unknown>;

/** Which storage bucket an uploaded image lives in. */
const bucketFor = (image: Row) => (image.kind === "poster" || image.kind === "backdrop" ? "covers" : "media");

/** Builds the ZIP: data.json plus every uploaded image under images/<bucket>/<path>. */
export async function exportZip(onProgress: (done: number, total: number) => void): Promise<Result<Blob>> {
  const bundle = await services.data.exportTables();
  if (!bundle.ok) return bundle;

  const uploads = (bundle.value.tables.images ?? []).filter((image) => image.source === "upload");
  const files: ZipFile[] = [{ name: "data.json", data: encoder.encode(JSON.stringify(bundle.value)) }];
  let done = 0;
  for (const image of uploads) {
    const blob = await services.data.downloadFile(bucketFor(image), image.path as string);
    // A missing file should not block the whole backup; the row still comes back on restore.
    if (blob.ok) files.push({ name: `images/${bucketFor(image)}/${image.path}`, data: new Uint8Array(await blob.value.arrayBuffer()) });
    onProgress(++done, uploads.length);
  }
  await services.settings.markBackup();
  return ok(createZip(files));
}

export async function exportJson(): Promise<Result<Blob>> {
  const bundle = await services.data.exportTables();
  if (!bundle.ok) return bundle;
  await services.settings.markBackup();
  return ok(new Blob([JSON.stringify(bundle.value, null, 2)], { type: "application/json" }));
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

/** Restores from a ZIP or JSON backup made by this app. Matching rows are updated, not duplicated. */
export async function importBackup(file: File, onProgress: (message: string) => void): Promise<Result<string>> {
  let bundle: ExportBundle;
  let images: ZipFile[] = [];
  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const files = await readZip(file);
      const data = files?.find((f) => f.name === "data.json");
      if (!files || !data) return fail("That ZIP is not a filmè backup.");
      bundle = JSON.parse(new TextDecoder().decode(data.data)) as ExportBundle;
      images = files.filter((f) => f.name.startsWith("images/"));
    } else {
      bundle = JSON.parse(await file.text()) as ExportBundle;
    }
  } catch {
    return fail("That file could not be read.");
  }
  if (bundle?.version !== 1 || typeof bundle.tables !== "object") return fail("That is not a filmè backup.");

  onProgress("Restoring your log…");
  const res = await services.data.importTables(bundle);
  if (!res.ok) return res;

  let restored = 0;
  for (const [i, image] of images.entries()) {
    onProgress(`Restoring pictures (${i + 1} of ${images.length})…`);
    const [, bucket, ...rest] = image.name.split("/");
    const type = /\.png$/.test(image.name) ? "image/png" : /\.webp$/.test(image.name) ? "image/webp" : "image/jpeg";
    const up = await services.data.uploadFile(bucket, rest.join("/"), new Blob([image.data as Uint8Array<ArrayBuffer>], { type }));
    if (up.ok) restored++;
  }
  return ok(`Restored ${res.value} rows${images.length ? ` and ${restored} of ${images.length} pictures` : ""}.`);
}
