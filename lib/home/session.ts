// lib/home/session.ts
// What Home last showed, kept in memory while the app stays open, so coming back to Home (the Back button) shows the same
// rows and shortcut circles at once instead of starting over. It is empty on a fresh open, which is when Home builds itself.
import type { IconName } from "@/components/Icon";
import type { AppNotification } from "@/lib/ports/notifications";

export interface ShortcutStory {
  key: string;
  href: string;
  icon: IconName;
  label: string;
}

export const homeSnapshot: { rows: string[] | null; notes: AppNotification[]; stories: ShortcutStory[] } = { rows: null, notes: [], stories: [] };
