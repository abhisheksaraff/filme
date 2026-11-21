// components/EntryActions.tsx
// The buttons that sit around Save on the new-entry and edit pages: Rescan tickets above it, Cancel below it.
"use client";

import Icon from "@/components/Icon";

const SHAPE = { full: "rounded-full py-4", box: "rounded-2xl py-3" } as const;

/** Light grey, with the recycle arrows above the words in a darker grey. */
export function RescanButton({ onClick, disabled, shape }: { onClick: () => void; disabled?: boolean; shape: keyof typeof SHAPE }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1 bg-neutral-100 px-5 text-sm font-medium text-neutral-600 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 ${SHAPE[shape].replace("py-4", "py-3")}`}>
      <span className="text-neutral-600 dark:text-neutral-300"><Icon name="refresh" size={20} /></span>
      Rescan tickets
    </button>
  );
}

/** A darker grey than Rescan, so the two are not confused. */
export function CancelButton({ onClick, disabled, shape }: { onClick: () => void; disabled?: boolean; shape: keyof typeof SHAPE }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`bg-neutral-300 px-5 text-base font-medium text-neutral-900 disabled:opacity-50 dark:bg-neutral-600 dark:text-white ${SHAPE[shape]}`}>
      Cancel
    </button>
  );
}
