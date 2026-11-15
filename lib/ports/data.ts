// lib/ports/data.ts
import type { Result } from "./result";

/** Every table that belongs to the user, as plain rows. */
export interface ExportBundle {
  version: 1;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** One uploaded image as the database knows it. */
export interface ImageRow {
  id: string;
  kind: string;
  path: string;
  /** Which file store holds the file. */
  store: string;
}

/** Reads and writes the raw data for backups and restores. */
export interface DataRepository {
  exportTables(): Promise<Result<ExportBundle>>;
  /** Puts exported rows back, matching by id so restoring twice does not duplicate anything. */
  importTables(bundle: ExportBundle): Promise<Result<number>>;
  /** Uploaded images (not TMDB ones), optionally only those in one store. */
  imageRows(filter?: { store?: string; limit?: number }): Promise<Result<ImageRow[]>>;
  /** Records that an image's file now lives in a different store. */
  setImageStore(id: string, store: string): Promise<Result<void>>;
  /** Custom posters and covers are kept apart from the other images, in a public bucket. */
  readCover(path: string): Promise<Result<Blob>>;
  writeCover(path: string, blob: Blob): Promise<Result<void>>;
}
