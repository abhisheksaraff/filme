// lib/maintenance.ts
// Small chores that run quietly when Home opens: cleanup, filling in credits, and report banners.
import { backfillCredits } from "@/lib/credits";
import { buildStory, periodFor, previousPeriod } from "@/lib/domain/stories";
import { moveLegacyImages } from "@/lib/imageMove";
import { checkNewEpisodes } from "@/lib/shows";
import { dailyCompletionCheck } from "@/lib/completions";
import { loadStatRows } from "@/lib/home/rows";
import { services } from "@/lib/services";

const BACKUP_EVERY_DAYS = 30;

/** Creates the monthly report, yearly report and backup-reminder banners that are due. */
async function ensureBanners(): Promise<void> {
  const now = new Date();
  const rows = await loadStatRows();
  if (rows.ok) {
    const month = previousPeriod("month", now);
    if (buildStory(rows.value, "month", month).length > 0) await services.notifications.ensure("report-month", month);
    // The year in review becomes available once a new year has started.
    const year = previousPeriod("year", now);
    if (buildStory(rows.value, "year", year).length > 0) await services.notifications.ensure("report-year", year);
  }

  const last = await services.settings.lastBackup();
  if (last.ok) {
    const days = last.value ? (now.getTime() - new Date(last.value).getTime()) / 86_400_000 : Infinity;
    // One reminder per month, so dismissing it keeps it away until the next month.
    if (days > BACKUP_EVERY_DAYS && rows.ok && rows.value.length > 0) await services.notifications.ensure("backup", periodFor("month", now));
  }
}

let started = false;

/** Runs once per page load; every step is allowed to fail without bothering the user. */
export function runMaintenance(): void {
  if (started) return;
  started = true;
  void (async () => {
    await services.log.purgeExpired();
    await checkNewEpisodes();
    await dailyCompletionCheck();
    await ensureBanners();
    await backfillCredits();
    await moveLegacyImages();
  })().catch(() => undefined);
}
