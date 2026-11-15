// components/ViewingDetails.tsx
// The small print under a viewing in a list: auditorium, seat pills, format and extras, date and time.
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
}

/** Seats wrap onto more lines for a group instead of spilling out, so a tile never cuts them off. */
export default function ViewingDetails({ auditorium, seats, totalTickets, format, addons, watchedOn, watchedAt, compact }: Props) {
  const small = compact ? "text-[11px]" : "text-xs";
  const text = [format, ...addons].filter(Boolean).join(" · ");
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
      {text && <span className="text-neutral-600 dark:text-neutral-400">{text}</span>}
      {(watchedOn || watchedAt) && <span className="mt-auto pt-0.5 text-[10px] text-neutral-500">{[watchedOn, watchedAt].filter(Boolean).join(" · ")}</span>}
    </div>
  );
}
