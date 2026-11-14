// components/BottomNav.tsx
// A floating pill with the main places; the middle ticket button starts a new log entry.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const TABS = [
  { href: "/home/", label: "Home", icon: icon(<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />) },
  { href: "/calendar/", label: "Calendar", icon: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>) },
  { href: "/watchlist/", label: "Log", center: true, icon: icon(<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v12" />) },
  { href: "/want/", label: "Want to watch", icon: icon(<path d="M6 4h12v17l-6-4-6 4z" />) },
  { href: "/profile/", label: "Profile", icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>) },
];

export default function BottomNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ul className="flex items-center gap-1 rounded-full bg-neutral-950 px-2 py-2 text-neutral-400 shadow-lg dark:bg-neutral-800">
        {TABS.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center rounded-full transition-colors ${
                  tab.center ? "h-12 w-12 bg-white text-neutral-950" : `h-11 w-11 ${active ? "bg-neutral-700 text-white" : ""}`
                }`}
              >
                {tab.icon}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
