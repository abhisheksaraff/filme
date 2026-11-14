// components/HomeNotices.tsx
// Banners for finished months and years and the backup reminder. Dismissing only hides the banner.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { storyTitle, type StoryKind } from "@/lib/domain/stories";
import type { AppNotification } from "@/lib/ports/notifications";
import { services } from "@/lib/services";

function describe(n: AppNotification): { text: string; href: string } {
  if (n.kind === "backup") return { text: "It has been a while since your last backup.", href: "/profile/data/" };
  const kind: StoryKind = n.kind === "report-year" ? "year" : "month";
  return { text: `${storyTitle(kind, n.period)} is ready to look back on.`, href: `/story/?kind=${kind}&period=${n.period}` };
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
        const { text, href } = describe(n);
        return (
          <li key={n.id} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-900">
            <Link href={href} className="flex-1">{text}</Link>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(n.id)} className="px-1 text-neutral-500">✕</button>
          </li>
        );
      })}
    </ul>
  );
}
