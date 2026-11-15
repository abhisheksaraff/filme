// components/StatusBadge.tsx
// A small black circle with a white drawing in it: a bookmark for a title on your watchlist, an eye for one you have watched.
import Icon from "@/components/Icon";

interface Props {
  kind: "watchlist" | "watched";
  /** Circle size in px; the drawing inside is a little over half of it. */
  size?: number;
  className?: string;
}

export default function StatusBadge({ kind, size = 24, className = "" }: Props) {
  return (
    <span
      role="img"
      aria-label={kind === "watchlist" ? "On your watchlist" : "Watched"}
      style={{ width: size, height: size }}
      className={`pointer-events-none flex shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md ring-2 ring-white dark:ring-neutral-950 ${className}`}
    >
      <Icon name={kind === "watchlist" ? "bookmark" : "eye"} size={Math.round(size * 0.58)} filled={kind === "watchlist"} />
    </span>
  );
}
