// lib/ports/settings.ts
import type { Appearance } from "@/lib/domain/appearance";
import type { MovingDates } from "@/lib/domain/holidays";
import type { Result } from "./result";

/** Where the user is, for theatre listings and the "Current location" label. */
export interface UserLocation {
  city: string;
  /** ISO country code, upper case. */
  region: string;
}

/** Per-user preferences. */
export interface SettingsRepository {
  /** Ids of the Home rows switched on, in order. Empty means Home has not been customised. */
  homeRows(): Promise<Result<string[]>>;
  saveHomeRows(ids: string[]): Promise<Result<void>>;
  appearance(): Promise<Result<Appearance>>;
  saveAppearance(appearance: Appearance): Promise<Result<void>>;
  location(): Promise<Result<UserLocation | null>>;
  saveLocation(location: UserLocation): Promise<Result<void>>;
  /** When the user last made a backup, as an ISO time, or null. */
  lastBackup(): Promise<Result<string | null>>;
  markBackup(): Promise<Result<void>>;
  movingDates(year: number): Promise<Result<MovingDates>>;
  saveMovingDates(year: number, dates: MovingDates): Promise<Result<void>>;
}
