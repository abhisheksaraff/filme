// components/StatusBadge.tsx
// A small black circle with a white drawing in it: a bookmark for a title on your watchlist, an eye for one you have watched.
// A show that is only partly watched gets no eye at all: a thin grey ring that a white arc fills as episodes are logged.
import Icon from "@/components/Icon";

interface Props {
  kind: "watchlist" | "watched";
  /**
   * Circle size in px. Leave it out and the circle takes a quarter of the width of whatever it sits on (the poster), within
   * limits, so it grows and shrinks with the picture; the drawing and the ring's thickness scale with it.
   */
  size?: number;
  /** For "watched": how much of a show is logged, from 0 to 1. Leave out (or 1) for a movie or a finished show. */
  progress?: number;
  className?: string;
}

/** Never shown as empty or as full until it truly is: at least a twelfth, at most just short of the whole ring. */
const arc = (progress: number) => Math.min(0.97, Math.max(1 / 12, progress));
/** The ring is drawn on a 100-unit square so it scales with the circle. */
const R = 42;
const STROKE = 13;
const LENGTH = 2 * Math.PI * R;

export default function StatusBadge({ kind, size, progress, className = "" }: Props) {
  const partly = kind === "watched" && progress !== undefined && progress < 1;
  // No `relative` here: the caller places the badge (absolute, top right), and a position set here would override that.
  const box = size !== undefined ? { width: size, height: size } : { width: "24%", minWidth: 18, maxWidth: 40, aspectRatio: "1 / 1" };
  return (
    <span
      role="img"
      aria-label={kind === "watchlist" ? "On your watchlist" : partly ? "Partly watched" : "Watched"}
      style={box}
      className={`pointer-events-none flex shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md ring-2 ring-white dark:ring-neutral-950 ${className}`}
    >
      <span className="relative flex h-full w-full items-center justify-center">
        {partly ? (
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#6b7280" strokeWidth={STROKE} />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff" strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={`${arc(progress) * LENGTH} ${LENGTH}`} />
          </svg>
        ) : (
          <span className="flex h-[58%] w-[58%] items-center justify-center [&>svg]:h-full [&>svg]:w-full">
            <Icon name={kind === "watchlist" ? "bookmark" : "eye"} size={size !== undefined ? Math.round(size * 0.58) : 14} filled={kind === "watchlist"} />
          </span>
        )}
      </span>
    </span>
  );
}
