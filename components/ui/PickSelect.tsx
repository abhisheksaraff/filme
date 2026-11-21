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
  /** Shows a round x beside the box once something is picked, to put it back to the default. */
  clearable?: boolean;
}

export default function PickSelect({ value, onChange, options, label, idle = "", className = "", clearable = false }: Props) {
  const picked = options.find((o) => o.value === value);
  const on = value !== idle;
  return (
    <div className={`flex h-10 min-w-0 items-center gap-1 ${className}`}>
    <div className="relative h-10 min-w-0 flex-1">
      <div className={`pointer-events-none flex h-full items-center justify-between gap-2 rounded-full px-4 text-sm ${on ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        <span className="truncate">{picked?.shown ?? picked?.label ?? ""}</span>
        <Icon name="chevronDown" size={16} />
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
    {clearable && on && (
      <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange(idle)} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-500/15 text-neutral-500 before:absolute before:-inset-1.5 before:content-['']">
        <Icon name="close" size={16} />
      </button>
    )}
    </div>
  );
}
