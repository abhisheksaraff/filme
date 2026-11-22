// lib/home/session.ts
// What Home last showed, kept in memory while the app stays open, so coming back to Home (the Back button) shows the same
// rows and shortcut circles at once instead of starting over. It is empty on a fresh open, which is when Home builds itself.
import type { IconName } from "@/components/Icon";

export interface ShortcutStory {
  key: string;
  kind: "day" | "month" | "year";
  period: string;
  href: string;
  icon: IconName;
  label: string;
  /** Watched to the end: it leaves the row under the search and joins the replay circle at the top. */
  seen: boolean;
  /** When it was watched to the end; the replay plays the latest first. */
  finishedAt: string | null;
}

/** `claims`: for each row that finished, the titles it shows, so a row below can leave them out. */
export const homeSnapshot: { rows: string[] | null; stories: ShortcutStory[]; claims: Record<string, string[]> } = { rows: null, stories: [], claims: {} };
