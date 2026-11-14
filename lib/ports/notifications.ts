// lib/ports/notifications.ts
import type { Result } from "./result";

export interface AppNotification {
  id: string;
  /** "report-month", "report-year" or "backup". */
  kind: string;
  /** The month, year or reminder month it is about. */
  period: string;
  createdAt: string;
}

/**
 * Banners on Home. Dismissing one only hides the banner; the report it points to stays available.
 * They are stored in the database, so dismissing on one device dismisses everywhere.
 */
export interface NotificationRepository {
  active(): Promise<Result<AppNotification[]>>;
  /** Creates the notification once per kind and period; a dismissed one is not created again. */
  ensure(kind: string, period: string): Promise<Result<void>>;
  dismiss(id: string): Promise<Result<void>>;
}
