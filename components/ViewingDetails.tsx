// components/ViewingDetails.tsx
// The small print under a viewing in a list: auditorium, seat pills, format and extras, date and time.
"use client";

import Link from "next/link";
import { useState } from "react";
import { seatLabel } from "@/components/entryDraft";
import type { SeatDetail } from "@/lib/domain/sessions";

interface Props {
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  format: string | null;
  addons: string[];
  watchedOn: string | null;
  watchedAt: string | null;
  /** Smaller type for tiles two to a row. */
  compact?: boolean;
  /** Makes the format and each extra open Search with just that one. Off inside a tile that is itself a link. */
  links?: boolean;
}

/** Seats wrap onto more lines for a group instead of spilling out, so a tile never cuts them off. */
export default function ViewingDetails({ auditorium, seats, totalTickets, format, addons, watchedOn, watchedAt, compact, links }: Props) {
  // A new stamp per visit lets the same format be tapped again later and still apply.
  const [stamp] = useState(() => Date.now());
  const small = compact ? "text-[11px]" : "text-xs";
  const tags = [format ? { label: format, href: `/search/?format=${encodeURIComponent(format)}&at=${stamp}` } : null, ...addons.map((a) => ({ label: a, href: `/search/?extra=${encodeURIComponent(a)}&at=${stamp}` }))].filter((t): t is { label: string; href: string } => t !== null);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${small}`}>
      {auditorium && <span className="text-neutral-700 dark:text-neutral-300">{auditorium}</span>}
      {seats.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {seats.map((seat, i) => <span key={i} className="rounded-full bg-neutral-950 px-2 py-px text-[10px] leading-4 text-white dark:bg-white dark:text-neutral-950">{seatLabel(seat)}</span>)}
        </span>
      ) : totalTickets ? (
        <span className="text-neutral-600 dark:text-neutral-400">{totalTickets} {totalTickets === 1 ? "ticket" : "tickets"}</span>
      ) : null}
      {tags.length > 0 && (
        <span className="flex flex-wrap gap-x-2 text-neutral-600 dark:text-neutral-400">
          {tags.map((t, i) => (
            <span key={t.label}>{links ? <Link href={t.href}>{t.label}</Link> : t.label}{i < tags.length - 1 ? " ·" : ""}</span>
          ))}
        </span>
      )}
      {(watchedOn || watchedAt) && <span className="mt-auto pt-0.5 text-[10px] text-neutral-500">{[watchedOn, watchedAt].filter(Boolean).join(" · ")}</span>}
    </div>
  );
}
