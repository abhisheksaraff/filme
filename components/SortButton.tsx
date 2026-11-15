// components/SortButton.tsx
// A round button that opens the phone's own picker to choose how a list is ordered. The picker sits invisibly over the circle, so a tap anywhere on it opens it.
import Icon from "@/components/Icon";

interface Props<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}

export default function SortButton<T extends string>({ value, options, onChange, label = "Sort" }: Props<T>) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white">
      <Icon name="filter" size={20} />
      <select
        aria-label={label}
        title={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0"
      >
        {options.map((o) => <option key={o.id} value={o.id} className="text-black">{o.label}</option>)}
      </select>
    </span>
  );
}
