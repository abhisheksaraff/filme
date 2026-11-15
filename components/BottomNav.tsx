// components/BottomNav.tsx
// A floating pill with the main places. The current one sits in a grey circle; Home, Calendar, Map, Watched and Watchlist fill their icon in white, wholly or in part.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName; fills?: boolean }[] = [
  { href: "/home/", label: "Home", icon: "home", fills: true },
  { href: "/calendar/", label: "Calendar", icon: "calendar", fills: true },
  { href: "/map/", label: "Map", icon: "map", fills: true },
  { href: "/watchlist/", label: "Watched", icon: "ticket", fills: true },
  { href: "/want/", label: "Watchlist", icon: "bookmark", fills: true },
  { href: "/scan/", label: "Add an entry", icon: "plus" },
];

export default function BottomNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className="flex items-center gap-1 rounded-full bg-neutral-950 px-2 py-2 max-[380px]:gap-0.5 text-white shadow-lg dark:bg-neutral-800">
        {TABS.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 w-12 max-[380px]:h-11 max-[380px]:w-11 items-center justify-center rounded-full transition-colors ${active ? "bg-neutral-600 text-white" : "text-white"}`}
              >
                <Icon name={tab.icon} size={22} filled={active && tab.fills} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
