// components/HomeStories.tsx
// Chips on Home that open today's, this month's and this year's recap, when the log has one.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildStory, periodFor, previousPeriod, storyTitle, type StoryKind } from "@/lib/domain/stories";
import { loadStatRows } from "@/lib/home/rows";

const KINDS: StoryKind[] = ["day", "month", "year"];

export default function HomeStories({ nonce }: { nonce: number }) {
  const [chips, setChips] = useState<{ kind: StoryKind; period: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadStatRows().then((res) => {
      if (cancelled || !res.ok) return;
      const now = new Date();
      setChips(
        [
          ...KINDS.map((kind) => ({ kind, period: periodFor(kind, now) })),
          { kind: "month" as StoryKind, period: previousPeriod("month", now) },
          { kind: "year" as StoryKind, period: previousPeriod("year", now) },
        ]
          // Empty recaps are not shown at all.
          .filter(({ kind, period }) => buildStory(res.value, kind, period).length > 0)
          .map(({ kind, period }) => ({ kind, period, label: storyTitle(kind, period) })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  if (chips.length === 0) return null;
  return (
    <ul className="-mx-6 flex gap-2 overflow-x-auto px-6">
      {chips.map((chip) => (
        <li key={`${chip.kind}-${chip.period}`}>
          <Link
            href={`/story/?kind=${chip.kind}&period=${chip.period}`}
            className="block whitespace-nowrap rounded-full border border-[var(--accent,#a3a3a3)] px-4 py-1.5 text-sm"
          >
            {chip.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
