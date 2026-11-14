// lib/ports/settings.ts
import type { Appearance } from "@/lib/domain/appearance";
import type { Result } from "./result";

/** Per-user preferences. */
export interface SettingsRepository {
  /** Ids of the Home rows switched on, in order. Empty means Home has not been customised. */
  homeRows(): Promise<Result<string[]>>;
  saveHomeRows(ids: string[]): Promise<Result<void>>;
  appearance(): Promise<Result<Appearance>>;
  saveAppearance(appearance: Appearance): Promise<Result<void>>;
}
