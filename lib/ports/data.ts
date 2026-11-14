// lib/ports/data.ts
import type { Result } from "./result";

/** Every table that belongs to the user, as plain rows. */
export interface ExportBundle {
  version: 1;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Reads and writes the raw data for backups and restores. */
export interface DataRepository {
  exportTables(): Promise<Result<ExportBundle>>;
  /** Puts exported rows back, matching by id so restoring twice does not duplicate anything. */
  importTables(bundle: ExportBundle): Promise<Result<number>>;
  downloadFile(bucket: string, path: string): Promise<Result<Blob>>;
  uploadFile(bucket: string, path: string, blob: Blob): Promise<Result<void>>;
}
