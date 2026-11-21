// components/ui/DateField.tsx
// The app's one date or month box: on a phone it shows today's date in grey as an example while empty, and a small x to clear it.
"use client";

import Icon from "@/components/Icon";

interface Props {
  type?: "date" | "month";
  value: string;
  onChange: (value: string) => void;
  label: string;
  max?: string;
  /** Replaces the default look (colour and height only; the padding is fixed so the box never grows past its column). */
  className?: string;
  /** What the grey example shows: today, or the same day a year ago (for a From box, so it differs from To). */
  hint?: "today" | "yearAgo";
  /** Colour of the example text and the x; defaults suit the normal grey boxes. */
  hintClass?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today written the way people say it, as an example only; it is never put into the box. */
function example(type: "date" | "month", hint: "today" | "yearAgo"): string {
  const now = new Date();
  if (hint === "yearAgo") now.setFullYear(now.getFullYear() - 1);
  const month = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  return type === "month" ? month : `${now.getDate()} ${month}`;
}

export default function DateField({ type = "date", value, onChange, label, max, className = "h-10 bg-neutral-100 dark:bg-neutral-800", hintClass = "text-neutral-400", hint = "today" }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-full">
        <input type={type} value={value} max={max} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`block w-full min-w-0 max-w-full appearance-none rounded-full pl-4 pr-3 text-base outline-none [&::-webkit-date-and-time-value]:flex [&::-webkit-date-and-time-value]:h-full [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:items-center [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:items-center ${className}`} />
        {/* Safari on a phone draws nothing inside an empty date box, so the example sits on top of it and lets taps through. A computer's browser draws its own format there, so the example is left off or the two would show together. */}
        {!value && <span aria-hidden className={`pointer-events-none absolute left-4 right-3 top-1/2 hidden -translate-y-1/2 truncate text-sm [@media(pointer:coarse)]:block ${hintClass}`}>{example(type, hint)}</span>}
      </div>
      {/* Once a date is set, a round x sits beside the box. Its tap area reaches past the circle, so it clears the date instead of opening the picker. */}
      {value && (
        <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange("")} className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-500/15 before:absolute before:-inset-1.5 before:content-[''] ${hintClass}`}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
