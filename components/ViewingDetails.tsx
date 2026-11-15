// components/ViewingDetails.tsx
// The small print of a viewing, in two parts so a card can fold: the summary (first seats, format, date and time) is always
// shown, and the rest (auditorium, remaining seats, extras) rolls out when the card opens.
"use client";

import type { ReactNode } from "react";
import { seatLabel } from "@/components/entryDraft";
import type { SeatDetail } from "@/lib/domain/sessions";

/** Seats shown while a card is folded. */
export const FOLDED_SEATS = 3;

interface Props {
  view: "summary" | "more";
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  format: string | null;
  addons: string[];
  watchedOn: string | null;
  watchedAt: string | null;
  /** Sits at the right end of the seats line, such as the picture circles. */
  trailing?: ReactNode;
}

const chip = "rounded-full bg-neutral-950 px-2 py-px text-[10px] leading-4 text-white dark:bg-white dark:text-neutral-950";

/** Whether opening a card would reveal anything beyond what the folded card shows. */
export function hasMoreDetail(props: { auditorium: string | null; seats: SeatDetail[]; addons: string[]; notes?: string | null }): boolean {
  return Boolean(props.auditorium || props.seats.length > FOLDED_SEATS || props.addons.length > 0 || props.notes);
}

export default function ViewingDetails({ view, auditorium, seats, totalTickets, format, addons, watchedOn, watchedAt, trailing }: Props) {
  if (view === "more") {
    const rest = seats.slice(FOLDED_SEATS);
    return (
      <div className="flex min-w-0 flex-col gap-1 text-xs">
        {auditorium && <span className="text-neutral-700 dark:text-neutral-300">{auditorium}</span>}
        {rest.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {rest.map((seat, i) => <span key={i} className={chip}>{seatLabel(seat)}</span>)}
          </span>
        )}
        {addons.length > 0 && <span className="text-neutral-600 dark:text-neutral-400">{addons.join(" · ")}</span>}
      </div>
    );
  }

  const first = seats.slice(0, FOLDED_SEATS);
  const hasLine = first.length > 0 || totalTickets || format || trailing;
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs">
      {hasLine && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {first.length > 0 ? (
            <span className="flex flex-wrap gap-1">{first.map((seat, i) => <span key={i} className={chip}>{seatLabel(seat)}</span>)}</span>
          ) : totalTickets ? (
            <span className="text-neutral-600 dark:text-neutral-400">{totalTickets} {totalTickets === 1 ? "ticket" : "tickets"}</span>
          ) : null}
          {format && <span className="text-neutral-600 dark:text-neutral-400">{format}</span>}
          {trailing}
        </span>
      )}
      {(watchedOn || watchedAt) && <span className="pt-0.5 text-[10px] text-neutral-500">{[watchedOn, watchedAt].filter(Boolean).join(" · ")}</span>}
    </div>
  );
}
