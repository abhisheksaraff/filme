// components/HomeShortcuts.tsx
// One row of icon circles under the search pill: unread notifications, the map, read
// notifications, then recaps. Refresh and customize stay pinned at the right.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import { buildStory, periodFor, previousPeriod, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";
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

function describe(n: AppNotification): { label: string; href: string; icon: IconName } {
  if (n.kind === "new-episode") {
    const [mediaId, , ...name] = n.period.split("|");
    return { label: name.join("|") || "New episode", href: `/title/?id=${mediaId}`, icon: "tv" };
  }
  const kind: StoryKind = n.kind === "report-year" ? "year" : "month";
  return { label: kind === "year" ? "Year recap" : "Month recap", href: `/story/?kind=${kind}&period=${n.period}`, icon: "sparkle" };
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

export default function HomeShortcuts({ nonce, onShuffle }: { nonce: number; onShuffle: () => void }) {
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [stories, setStories] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Maintenance creates notifications a moment after Home opens, so look again shortly.
    const load = () =>
      services.notifications.active().then((res) => {
        if (cancelled || !res.ok) return;
        const now = Date.now();
        setNotes(res.value.filter((n) => !n.readAt || now - Date.parse(n.readAt) < READ_VISIBLE_MS));
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
      const candidates: { kind: StoryKind; period: string; label: string; icon: IconName }[] = [
        { kind: "day", period: periodFor("day", now), label: "On this day", icon: "clock" },
        { kind: "month", period: periodFor("month", now), label: "This month", icon: "calendar" },
        { kind: "year", period: periodFor("year", now), label: "This year", icon: "star" },
        { kind: "month", period: previousPeriod("month", now), label: "Last month", icon: "calendarPlus" },
        { kind: "year", period: previousPeriod("year", now), label: "Last year", icon: "archive" },
      ];
      // Recaps with nothing in them are left out.
      setStories(
        candidates
          .filter((c) => buildStory(res.value, c.kind, c.period).length > 0)
          .map((c) => ({ key: `${c.kind}-${c.period}`, href: `/story/?kind=${c.kind}&period=${c.period}`, icon: c.icon, label: c.label })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  function open(id: string) {
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    services.notifications.markRead(id);
  }

  const toItem = (n: AppNotification): Item => ({ key: n.id, ...describe(n), unread: !n.readAt, onOpen: n.readAt ? undefined : () => open(n.id) });
  // Backup reminders no longer get a circle on Home; Profile already has the backup tools.
  const shown = notes.filter((n) => n.kind !== "backup");
  const unread = shown.filter((n) => !n.readAt).map(toItem);
  const read = shown.filter((n) => n.readAt).map(toItem);
  const map: Item = { key: "map", href: "/map/", icon: "map", label: "Map" };

  return (
    <div className="flex items-start gap-2">
      <ul className="-ml-1 flex min-w-0 flex-1 gap-2 overflow-x-auto pl-1">
        {[...unread, map, ...read, ...stories].map((item) => <Circle key={item.key} item={item} />)}
      </ul>
      <div className="mt-2 flex shrink-0 gap-2">
        <RoundButton icon="refresh" label="Refresh" onClick={onShuffle} />
        <RoundButton icon="sliders" label="Customize Home" href="/home/customize/" />
      </div>
    </div>
  );
}
