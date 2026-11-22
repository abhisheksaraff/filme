// components/HomeShortcuts.tsx
// Under the search pill: a circle for each story you have not watched to the end yet (Your day, Your month, Your year), with a
// red dot. Once watched it leaves this row and joins the grey replay circle at the top. With none left, there is no row at all.
"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import type { ShortcutStory } from "@/lib/home/session";

export default function HomeShortcuts({ stories }: { stories: ShortcutStory[] }) {
  if (stories.length === 0) return null;
  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 wide:mx-auto wide:max-w-[62rem] wide:px-0">
      {stories.map((story) => (
        <li key={story.key} className="w-16 shrink-0">
          <Link href={story.href} className="flex flex-col items-center gap-1.5">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
              <Icon name={story.icon} size={22} />
              <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-950" />
            </span>
            <span className="w-full truncate text-center text-[11px] text-neutral-600 dark:text-neutral-400">{story.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
