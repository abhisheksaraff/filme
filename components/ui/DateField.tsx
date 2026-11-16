// components/ui/DateField.tsx
// The app's one date or month box: shows today's date in grey as an example while empty, and a small x to clear it.
"use client";

import Icon from "@/components/Icon";
import { FIELD } from "./fields";

interface Props {
  type?: "date" | "month";
  value: string;
  onChange: (value: string) => void;
  label: string;
  max?: string;
  /** Replaces the default look, such as on a dark page. */
  className?: string;
  /** Colour of the example text and the x; defaults suit the normal grey boxes. */
  hintClass?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today written the way people say it, as an example only; it is never put into the box. */
function example(type: "date" | "month"): string {
  const now = new Date();
  const month = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  return type === "month" ? month : `${now.getDate()} ${month}`;
}

export default function DateField({ type = "date", value, onChange, label, max, className = `${FIELD} w-full`, hintClass = "text-neutral-400" }: Props) {
  return (
    <div className="relative min-w-0">
      <input type={type} value={value} max={max} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`w-full min-w-0 pr-11 ${className}`} />
      {/* Safari draws nothing inside an empty date box, so the example sits on top of it and lets taps through. */}
      {!value && <span aria-hidden className={`pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm ${hintClass}`}>{example(type)}</span>}
      {value && (
        <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange("")} className={`absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full ${hintClass}`}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
