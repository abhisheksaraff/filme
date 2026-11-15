// components/ConfirmDialog.tsx
// A box that floats above the page and asks "are you sure?" before something is deleted.
"use client";

import Icon, { type IconName } from "@/components/Icon";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const BUTTON = "flex flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950";

export default function ConfirmDialog({ title, message, confirmLabel, confirmIcon = "trash", busy, onConfirm, onCancel }: Props) {
  return (
    // Tapping the dimmed area outside the box cancels, like the close button.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border-2 border-neutral-950 bg-[var(--background)] p-6 shadow-2xl dark:border-white"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
          <Icon name={confirmIcon} size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl">{title}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className={BUTTON} onClick={onCancel} disabled={busy}>
            <Icon name="close" size={18} />
            Cancel
          </button>
          <button type="button" className={BUTTON} onClick={onConfirm} disabled={busy}>
            <Icon name={confirmIcon} size={18} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
