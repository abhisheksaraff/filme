// components/StatusBadge.tsx
// A small black circle with a white drawing in it: a bookmark for a title on your watchlist, an eye for one you have watched.
// A show that is only partly watched gets a grey eye inside a thin grey ring that a white arc fills as episodes are logged.
import Icon from "@/components/Icon";

interface Props {
  kind: "watchlist" | "watched";
  /** Circle size in px; the drawing inside is a little over half of it. */
  size?: number;
  /** For "watched": how much of a show is logged, from 0 to 1. Leave out (or 1) for a movie or a finished show. */
  progress?: number;
  className?: string;
}

/** Never shown as empty or as full until it truly is: at least a twelfth, at most just short of the whole ring. */
const arc = (progress: number) => Math.min(0.97, Math.max(1 / 12, progress));

export default function StatusBadge({ kind, size = 24, progress, className = "" }: Props) {
  const partly = kind === "watched" && progress !== undefined && progress < 1;
  // Bigger posters get a thicker ring so it still reads.
  const stroke = Math.max(2, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span
      role="img"
      aria-label={kind === "watchlist" ? "On your watchlist" : partly ? "Partly watched" : "Watched"}
      style={{ width: size, height: size }}
      className={`pointer-events-none relative flex shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md ring-2 ring-white dark:ring-neutral-950 ${className}`}
    >
      {partly && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#6b7280" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ffffff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc(progress) * circumference} ${circumference}`} />
        </svg>
      )}
      <span className={partly ? "text-neutral-400" : ""}>
        <Icon name={kind === "watchlist" ? "bookmark" : "eye"} size={Math.round(size * (partly ? 0.5 : 0.58))} filled={kind === "watchlist"} />
      </span>
    </span>
  );
}
