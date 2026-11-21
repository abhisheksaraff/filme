// components/ui/SuggestionList.tsx
// The one list of suggestions that drops under a box while you type: a darker grey than the box itself so the two never blur
// together, corners rounded less than the pill-shaped boxes, and a thin line between suggestions that fades out at both ends.
import type { HTMLAttributes, ReactNode } from "react";

/** The smaller grey line under a suggestion's name (a year, an address, where it came from), readable on the list's grey. */
export const SUGGESTION_NOTE = "text-xs text-neutral-600 dark:text-neutral-300";

interface ListProps extends HTMLAttributes<HTMLUListElement> {
  /** Spoken name for the list. */
  label?: string;
  /** A long list scrolls inside a fixed height instead of growing down the page. */
  scroll?: boolean;
  children: ReactNode;
}

export default function SuggestionList({ label, scroll = false, className = "", children, ...rest }: ListProps) {
  return (
    <ul
      aria-label={label}
      className={`flex flex-col rounded-xl bg-neutral-300 text-sm dark:bg-neutral-700 ${scroll ? "max-h-72 overflow-y-auto overscroll-contain" : "overflow-hidden"} ${className}`}
      {...rest}
    >
      {children}
    </ul>
  );
}

/** One suggestion: put its own button inside. Every one after the first gets the fading line above it. */
export function SuggestionItem({ children }: { children: ReactNode }) {
  return (
    <li className="relative [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:inset-x-3 [&:not(:first-child)]:before:top-0 [&:not(:first-child)]:before:h-[0.5px] [&:not(:first-child)]:before:bg-gradient-to-r [&:not(:first-child)]:before:from-transparent [&:not(:first-child)]:before:via-neutral-400/60 [&:not(:first-child)]:before:to-transparent dark:[&:not(:first-child)]:before:via-neutral-500/70">
      {children}
    </li>
  );
}
