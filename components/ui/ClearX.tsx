// components/ui/ClearX.tsx
// A small grey x that sits inside the right end of a text box (whose wrapper is relative) and empties just that box.
import Icon from "@/components/Icon";

export default function ClearX({ label, onClear, className = "text-neutral-400" }: { label: string; onClear: () => void; className?: string }) {
  return (
    <button type="button" aria-label={`Clear ${label}`} onClick={onClear} className={`absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full ${className}`}>
      <Icon name="close" size={16} />
    </button>
  );
}
