// components/RewatchLine.tsx
// "Rewatch 3 · 12 of 208 episodes watched" with a progress bar, and an x on the right that resets the rewatch (after asking).
"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { ConfirmPopup } from "@/components/Popup";
import ProblemPopup from "@/components/ProblemPopup";
import type { Passes } from "@/lib/domain/passes";

interface Props {
  passes: Passes;
  onReset?: () => Promise<string | null>;
}

export default function RewatchLine({ passes, onReset }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { seen, total } = passes;
  if (total === 0) return null;

  const rewatch = passes.passes.length;
  const done = rewatch > 0 && seen === 0;
  const text = done ? `All ${total} ${total === 1 ? "episode" : "episodes"} watched` : `${rewatch > 0 ? `Rewatch ${rewatch} · ` : ""}${seen} of ${total} episodes watched`;
  // Only a rewatch under way can be reset; the first time through has nothing to start over from.
  const canReset = !!onReset && rewatch > 0 && seen > 0;

  async function reset() {
    if (!onReset) return;
    setBusy(true);
    const error = await onReset();
    setBusy(false);
    setAsking(false);
    if (error) setProblem(error);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{text}</span>
        {canReset && (
          <button type="button" aria-label="Reset this rewatch" onClick={() => setAsking(true)}
            className="relative flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 active:bg-neutral-300 before:absolute before:-inset-2 before:content-[''] dark:bg-neutral-800 dark:text-neutral-300 dark:active:bg-neutral-700">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full rounded-full bg-neutral-950 dark:bg-white" style={{ width: `${done ? 100 : (seen / total) * 100}%` }} />
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {asking && (
        <ConfirmPopup title="Reset this rewatch?" message="Your viewings stay. Only the progress of this rewatch starts over." confirmLabel="Reset" confirmIcon="refresh" busy={busy}
          onConfirm={() => void reset()} onCancel={() => setAsking(false)} />
      )}
    </div>
  );
}
