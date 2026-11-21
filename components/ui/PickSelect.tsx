// components/ui/PickSelect.tsx
// A dropdown that is grey while it holds its default and black once something else is picked. The real select sits invisibly on top, so the
// phone's own picker opens (and lists the plain option names) while the box shows the longer text for the picked one.
"use client";

import Icon from "@/components/Icon";

export interface PickOption {
  value: string;
  label: string;
  /** What the closed box says when this one is picked, if different from the list. */
  shown?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: PickOption[];
  label: string;
  /** The value that means "not set"; the box stays grey on it. */
  idle?: string;
  className?: string;
}

export default function PickSelect({ value, onChange, options, label, idle = "", className = "" }: Props) {
  const picked = options.find((o) => o.value === value);
  const on = value !== idle;
  return (
    <div className={`relative h-10 min-w-0 ${className}`}>
      <div className={`pointer-events-none flex h-full items-center justify-between gap-2 rounded-full px-5 text-base ${on ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        <span className="truncate">{picked?.shown ?? picked?.label ?? ""}</span>
        <Icon name="chevronDown" size={16} />
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
