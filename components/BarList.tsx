// components/BarList.tsx
// Labelled horizontal bars, each scaled against the largest value in the list.

export interface BarItem {
  label: string;
  value: number;
}

export default function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 truncate">{item.label}</span>
          <div className="h-2 flex-1 rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-2 rounded-full bg-[var(--accent,#171717)] dark:bg-[var(--accent,#ededed)]"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right tabular-nums text-neutral-500">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
