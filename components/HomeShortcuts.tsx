// components/HomeShortcuts.tsx
// One row of icon circles under the search pill: new-episode alerts, the map, then Your day, Your month and
// Your year. A new recap shows as a red dot on its circle rather than a circle of its own.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { buildStory, periodFor, previousPeriod, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";
import { homeSnapshot, type ShortcutStory } from "@/lib/home/session";
import { keepIfSame } from "@/lib/same";
import type { AppNotification } from "@/lib/ports/notifications";
import { services } from "@/lib/services";

/** Read notifications disappear after this long. */
const READ_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000;

interface Item {
  key: string;
  href: string;
  icon: IconName;
  label: string;
  unread?: boolean;
  onOpen?: () => void;
}

function describeEpisode(n: AppNotification): { label: string; href: string; icon: IconName } {
  const [mediaId, , ...name] = n.period.split("|");
  return { label: name.join("|") || "New episode", href: `/title/?id=${mediaId}`, icon: "tv" };
}

function Circle({ item }: { item: Item }) {
  return (
    <li className="w-16 shrink-0">
      <Link href={item.href} onClick={item.onOpen} className="flex flex-col items-center gap-1.5">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
          <Icon name={item.icon} size={22} />
          {item.unread && <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-950" />}
        </span>
        <span className="w-full truncate text-center text-[11px] text-neutral-600 dark:text-neutral-400">{item.label}</span>
      </Link>
    </li>
  );
}

export default function HomeShortcuts({ nonce }: { nonce: number }) {
  // Both start from what Home last showed, so coming back does not make the circles appear one by one.
  const [notes, setNotes] = useState<AppNotification[]>(() => homeSnapshot.notes);
  const [stories, setStories] = useState<ShortcutStory[]>(() => homeSnapshot.stories);

  useEffect(() => {
    let cancelled = false;
    // Maintenance creates notifications a moment after Home opens, so look again shortly.
    const load = () =>
      services.notifications.active().then((res) => {
        if (cancelled || !res.ok) return;
        const now = Date.now();
        const next = res.value.filter((n) => !n.readAt || now - Date.parse(n.readAt) < READ_VISIBLE_MS);
        homeSnapshot.notes = next;
        setNotes((prev) => keepIfSame(prev, next));
      });
    load();
    const timer = setTimeout(load, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nonce]);

  useEffect(() => {
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled || !res.ok) return;
      const now = new Date();
      // Today's date in past years, and the recaps of the month and the year that just finished.
      const candidates: { kind: StoryKind; period: string; label: string; icon: IconName; recap?: "month" | "year" }[] = [
        { kind: "day", period: periodFor("day", now), label: "Your day", icon: "clock" },
        { kind: "month", period: previousPeriod("month", now), label: "Your month", icon: "calendar", recap: "month" },
        { kind: "year", period: previousPeriod("year", now), label: "Your year", icon: "star", recap: "year" },
      ];
      // Recaps with nothing in them are left out.
      const next = candidates
        .filter((c) => buildStory(res.value, c.kind, c.period).length > 0)
        .map((c) => ({ key: `${c.kind}-${c.period}`, href: `/story/?kind=${c.kind}&period=${c.period}`, icon: c.icon, label: c.label, recap: c.recap }));
      homeSnapshot.stories = next;
      setStories((prev) => keepIfSame(prev, next));
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  function open(id: string) {
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    services.notifications.markRead(id);
  }

  /** Opening a recap reads its alert; the red dot goes with it. */
  function readRecaps(recap: "month" | "year") {
    for (const n of notes.filter((x) => x.kind === `report-${recap}` && !x.readAt)) open(n.id);
  }

  const toEpisode = (n: AppNotification): Item => ({ key: n.id, ...describeEpisode(n), unread: !n.readAt, onOpen: n.readAt ? undefined : () => open(n.id) });
  // Backup reminders and recap alerts get no circle of their own.
  const episodes = notes.filter((n) => n.kind === "new-episode");
  const unread = episodes.filter((n) => !n.readAt).map(toEpisode);
  const read = episodes.filter((n) => n.readAt).map(toEpisode);
  const map: Item = { key: "map", href: "/map/", icon: "map", label: "Map" };
  const recaps: Item[] = stories.map((st) => ({
    ...st,
    unread: st.recap ? notes.some((n) => n.kind === `report-${st.recap}` && !n.readAt) : false,
    onOpen: st.recap ? () => readRecaps(st.recap as "month" | "year") : undefined,
  }));

  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1">
      {[...unread, map, ...recaps, ...read].map((item) => <Circle key={item.key} item={item} />)}
    </ul>
  );
}
