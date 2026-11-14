// components/BottomNav.tsx
// The three main places in the app, pinned to the bottom of the screen.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home/", label: "Home" },
  { href: "/search/", label: "Search" },
  { href: "/watchlist/", label: "Log" },
  { href: "/profile/", label: "Profile" },
];

export default function BottomNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block py-3 text-center text-sm ${active ? "font-medium" : "text-neutral-500"}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
