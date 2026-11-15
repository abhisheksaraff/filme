// lib/ports/files.ts
import type { Result } from "./result";

/** The two places an image file can live. "files" is the S3-compatible store (Backblaze B2, R2...). */
export type StoreId = "supabase" | "files";

/** Where image files are kept. Paths look like "<user id>/<kind>/<file>" in every store. */
export interface FileStore {
  readonly id: StoreId;
  put(path: string, blob: Blob): Promise<Result<void>>;
  get(path: string): Promise<Result<Blob>>;
  /** Links the page can show for a while, keyed by path. Paths the store cannot find are left out. */
  urls(paths: string[]): Promise<Result<Map<string, string>>>;
  remove(paths: string[]): Promise<Result<void>>;
  /** Bytes the user has stored here. */
  usage(): Promise<Result<number>>;
}
