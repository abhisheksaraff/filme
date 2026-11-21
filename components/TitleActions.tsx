// components/TitleActions.tsx
// The round buttons under a title, in a fixed order: Watch, bookmark, plus.
"use client";

import RoundButton from "@/components/RoundButton";
import StatusBadge from "@/components/StatusBadge";
import WatchButton from "@/components/WatchButton";
import type { WatchContext } from "@/lib/domain/watchLinks";

interface Props {
  wanted: boolean;
  /** True once a viewing is logged; an eye then sits on the plus button. */
  watched?: boolean;
  /** Partway through (first time or a rewatch), from 0 to 1: a ring sits on the plus button instead of the eye. */
  progress?: number;
  /** False when the title was added by hand, so the watchlist has no catalogue entry to save. */
  canBookmark: boolean;
  /** What the Watch button needs to build its link; null hides the button (concerts and live events). */
  watch: WatchContext | null;
  busy?: boolean;
  onToggleWanted: () => void;
  onLog: () => void;
}

export default function TitleActions({ wanted, watched = false, progress, canBookmark, watch, busy, onToggleWanted, onLog }: Props) {
  return (
    <div className="flex items-center gap-3">
      {watch && <WatchButton watch={watch} />}
      <RoundButton
        icon="bookmark"
        filled={wanted}
        label={wanted ? "Remove from watchlist" : "Add to watchlist"}
        tone="dark"
        size="lg"
        disabled={busy || !canBookmark}
        onClick={onToggleWanted}
      />
      <span className="relative">
        <RoundButton icon="plus" label="Log a viewing" tone="dark" size="lg" onClick={onLog} />
        {progress !== undefined && progress < 1
          ? <StatusBadge kind="watched" progress={progress} size={22} className="absolute -right-1 -top-1" />
          : watched && <StatusBadge kind="watched" size={22} className="absolute -right-1 -top-1" />}
      </span>
    </div>
  );
}
