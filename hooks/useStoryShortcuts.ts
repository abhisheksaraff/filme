// hooks/useStoryShortcuts.ts
// The stories Home offers right now: today's "Your day", last month's and last year's recaps, those with something in them.
// Each says whether it was watched to the end. Expired ones are simply not offered: a new day, month or year brings the next.
"use client";

import { useEffect, useState } from "react";
import type { IconName } from "@/components/Icon";
import { buildStory, periodFor, previousPeriod, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";
import { homeSnapshot, type ShortcutStory } from "@/lib/home/session";
import { keepIfSame } from "@/lib/same";
import { prepareStories } from "@/lib/storyLoaders";
import { services } from "@/lib/services";

export function useStoryShortcuts(nonce: number): ShortcutStory[] {
  // Starts from what Home last showed, so coming back does not make the circles appear one by one.
  const [stories, setStories] = useState<ShortcutStory[]>(() => homeSnapshot.stories);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadStatRows(), services.storyViews.finished()]).then(([rows, finished]) => {
      if (cancelled || !rows.ok) return;
      const now = new Date();
      const candidates: { kind: StoryKind; period: string; label: string; icon: IconName }[] = [
        { kind: "day", period: periodFor("day", now), label: "Your day", icon: "clock" },
        { kind: "month", period: previousPeriod("month", now), label: "Your month", icon: "calendar" },
        { kind: "year", period: previousPeriod("year", now), label: "Your year", icon: "star" },
      ];
      // Stories with nothing in them are left out.
      const withContent = candidates.filter((c) => buildStory(rows.value, c.kind, c.period).length > 0);
      // A little later, get these stories' themes, pictures and music ready so they open and play cleanly.
      setTimeout(() => void prepareStories(rows.value, withContent), 4000);
      const done = new Map((finished.ok ? finished.value : []).map((f) => [`${f.kind}:${f.period}`, f.at]));
      const next: ShortcutStory[] = withContent.map((c) => ({
        key: `${c.kind}-${c.period}`,
        kind: c.kind,
        period: c.period,
        href: `/story/?kind=${c.kind}&period=${c.period}`,
        icon: c.icon,
        label: c.label,
        seen: done.has(`${c.kind}:${c.period}`),
        finishedAt: done.get(`${c.kind}:${c.period}`) ?? null,
      }));
      homeSnapshot.stories = next;
      setStories((prev) => keepIfSame(prev, next));
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return stories;
}
