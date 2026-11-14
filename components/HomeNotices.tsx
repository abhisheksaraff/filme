// components/HomeNotices.tsx
// Banners for finished months and years and the backup reminder. Dismissing only hides the banner.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import { storyTitle, type StoryKind } from "@/lib/domain/stories";
import type { AppNotification } from "@/lib/ports/notifications";
import { services } from "@/lib/services";

function describe(n: AppNotification): { text: string; href: string; icon: IconName } {
  if (n.kind === "backup") return { text: "Time for a backup", href: "/profile/data/", icon: "archive" };
  const kind: StoryKind = n.kind === "report-year" ? "year" : "month";
  return { text: `${storyTitle(kind, n.period)} is ready`, href: `/story/?kind=${kind}&period=${n.period}`, icon: "sparkle" };
}

export default function HomeNotices({ refresh }: { refresh: number }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Maintenance creates banners a moment after Home opens, so look again shortly.
    const load = () =>
      services.notifications.active().then((res) => {
        if (!cancelled && res.ok) setItems(res.value);
      });
    load();
    const timer = setTimeout(load, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  async function dismiss(id: string) {
    setItems((list) => list.filter((n) => n.id !== id));
    await services.notifications.dismiss(id);
  }

  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => {
        const { text, href, icon } = describe(n);
        return (
          <li key={n.id} className="flex items-center gap-3 rounded-full bg-neutral-100 py-2 pl-2 pr-2 text-sm dark:bg-neutral-900">
            <Link href={href} className="flex flex-1 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name={icon} size={18} /></span>
              <span className="font-medium">{text}</span>
            </Link>
            <RoundButton icon="close" label="Dismiss" size="sm" onClick={() => dismiss(n.id)} />
          </li>
        );
      })}
    </ul>
  );
}
