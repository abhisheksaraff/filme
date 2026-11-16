// components/ui/Choice.tsx
// The app's one checkbox and radio: a square with a thick black edge that fills solid black when chosen.
// The real input stays underneath (hidden but focusable), so labels, keyboards and screen readers work as usual.
"use client";

import type { ReactNode } from "react";

interface Props {
  type: "checkbox" | "radio";
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** Groups radios so only one is chosen. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

export default function Choice({ type, checked, onChange, children, name, disabled, className = "" }: Props) {
  return (
    <label className={`flex items-center gap-3 text-base ${disabled ? "opacity-50" : ""} ${className}`}>
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        // Safari restores form controls when you come back to a page; that must never override what the app holds.
        autoComplete="off"
        className="peer sr-only"
      />
      <span
        aria-hidden
        // Drawn from the value the app holds, not from the hidden input's own state.
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[2.5px] border-neutral-950 transition-colors ${checked ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-transparent"} peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-950 peer-focus-visible:ring-offset-2 dark:border-white dark:peer-focus-visible:ring-white dark:peer-focus-visible:ring-offset-neutral-950`}
      >
        {/* A tick, white on the black box (black on the white one in dark mode), so chosen and not chosen read at a glance. */}
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.500" /></svg>
        )}
      </span>
      <span className="flex-1">{children}</span>
    </label>
  );
}
