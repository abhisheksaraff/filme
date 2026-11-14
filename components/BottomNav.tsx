// components/BottomNav.tsx
// A floating pill with the main places. Only the current one is lit: a filled white circle.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/home/", label: "Home", icon: "home" },
  { href: "/calendar/", label: "Calendar", icon: "calendar" },
  { href: "/watchlist/", label: "Watched", icon: "ticket" },
  { href: "/want/", label: "Want to watch", icon: "bookmark" },
  { href: "/scan/", label: "Add an entry", icon: "plus" },
];

export default function BottomNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className="flex items-center gap-1 rounded-full bg-neutral-950 px-2 py-2 text-white shadow-lg dark:bg-neutral-800">
        {TABS.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-white text-neutral-950" : "text-white"}`}
              >
                <Icon name={tab.icon} size={22} filled={active} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
