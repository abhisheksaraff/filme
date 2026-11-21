// components/StatusBadge.tsx
// A small black circle with a white drawing in it: a bookmark for a title on your watchlist, an eye for one you have watched.
// A show that is only partly watched gets no eye at all: a thin grey ring that a white arc fills as episodes are logged.
import Icon from "@/components/Icon";

interface Props {
  /** The largest the badge grows with its poster, in pixels (smaller on Home's rows, where desktop posters are large). */
  maxSize?: number;
  kind: "watchlist" | "watched";
  /**
   * Circle size in px. Leave it out and the circle takes a quarter of the width of whatever it sits on (the poster), within
   * limits, so it grows and shrinks with the picture; the drawing and the ring's thickness scale with it.
   */
  size?: number;
  /** For "watched": how much of a show is logged, from 0 to 1. Leave out (or 1) for a movie or a finished show. */
  progress?: number;
  className?: string;
  /** Extra inline style, such as a `left` that moves the badge across the poster. */
  style?: React.CSSProperties;
}

/** Drawn as it is: a quarter of the ring is a quarter of the way round. Never empty until nothing is watched and never full until it is all watched. */
const arc = (progress: number) => Math.min(0.97, Math.max(0.04, progress));
/** The ring is drawn on a 100-unit square so it scales with the circle. */
const R = 40;
const STROKE = 18;
const LENGTH = 2 * Math.PI * R;

export default function StatusBadge({ kind, size, progress, maxSize = 40, className = "", style }: Props) {
  const partly = kind === "watched" && progress !== undefined && progress < 1;
  // No `relative` here: the caller places the badge (absolute, top right), and a position set here would override that.
  const box = size !== undefined ? { width: size, height: size } : { width: "24%", minWidth: 18, maxWidth: maxSize, aspectRatio: "1 / 1" };
  return (
    <span
      role="img"
      aria-label={kind === "watchlist" ? "On your watchlist" : partly ? "Partly watched" : "Watched"}
      style={{ ...box, ...style }}
      className={`pointer-events-none flex shrink-0 items-center justify-center rounded-full text-white ${partly ? "" : "bg-black shadow-md ring-2 ring-white dark:ring-neutral-950"} ${className}`}
    >
      <span className="relative flex h-full w-full items-center justify-center">
        {partly ? (
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            {/* A darker grey track with a hairline white edge inside and out, so the ring reads on black, grey or light pictures. */}
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(55,55,60,0.75)" strokeWidth={STROKE} />
            <circle cx="50" cy="50" r={R + STROKE / 2} fill="none" stroke="#ffffff" strokeWidth={1.4} />
            <circle cx="50" cy="50" r={R - STROKE / 2} fill="none" stroke="#ffffff" strokeWidth={1.4} />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff" strokeWidth={STROKE} strokeLinecap="butt" strokeDasharray={`${arc(progress) * LENGTH} ${LENGTH}`} />
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
