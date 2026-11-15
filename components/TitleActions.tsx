// components/TitleActions.tsx
// The round buttons under a title, in a fixed order: bookmark, tick (only once watched), Watch, plus.
"use client";

import Icon from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import WatchButton from "@/components/WatchButton";
import type { WatchContext } from "@/lib/domain/watchLinks";

interface Props {
  wanted: boolean;
  /** False when the title was added by hand, so the watchlist has no catalogue entry to save. */
  canBookmark: boolean;
  watched: boolean;
  /** What the Watch button needs to build its link; null hides the button (concerts and live events). */
  watch: WatchContext | null;
  busy?: boolean;
  onToggleWanted: () => void;
  onLog: () => void;
}

export default function TitleActions({ wanted, canBookmark, watched, watch, busy, onToggleWanted, onLog }: Props) {
  return (
    <div className="flex items-center gap-3">
      <RoundButton
        icon="bookmark"
        filled={wanted}
        label={wanted ? "Remove from watchlist" : "Add to watchlist"}
        tone="dark"
        size="lg"
        disabled={busy || !canBookmark}
        onClick={onToggleWanted}
      />
      {watched && (
        <span role="img" aria-label="Watched" title="Watched" className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-300 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          <Icon name="check" size={22} />
        </span>
      )}
      {watch && <WatchButton watch={watch} />}
      <RoundButton icon="plus" label="Log a viewing" tone="dark" size="lg" onClick={onLog} />
    </div>
  );
}
