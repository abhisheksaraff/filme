// components/LogMenu.tsx
// The + on a show: choose the whole series, a season or an episode, then log it today or open the form.
"use client";

import { useState } from "react";
import Popup, { POPUP_OPTION, POPUP_SECONDARY } from "@/components/Popup";
import WhenPopup from "@/components/WhenPopup";

interface Props {
  seasons: number[];
  busy?: boolean;
  /** `season` is null for the whole series; `today` is false when the form should open. */
  onLog: (season: number | null, today: boolean) => void;
  /** Episodes are picked from the season's own page. */
  onEpisodeSeason: (season: number) => void;
  /** Logs without a date; offered next to Today. */
  onLogUndated?: (season: number | null) => void;
  onClose: () => void;
}

export default function LogMenu({ seasons, busy, onLog, onEpisodeSeason, onLogUndated, onClose }: Props) {
  const [step, setStep] = useState<"pick" | "season" | "episode" | "when">("pick");
  const [season, setSeason] = useState<number | null>(null);

  if (step === "when") {
    return <WhenPopup what={season === null ? "the whole series" : `Season ${season}`} busy={busy} onToday={() => onLog(season, true)} onForm={() => onLog(season, false)} onUndated={onLogUndated ? () => onLogUndated(season) : undefined} onClose={onClose} />;
  }

  return (
    <Popup title={step === "pick" ? "Log what?" : step === "season" ? "Which season?" : "Episode from which season?"} onClose={onClose}>
      {step === "pick" ? (
        <div className="flex flex-col">
          <button type="button" className={POPUP_OPTION} onClick={() => { setSeason(null); setStep("when"); }}>Whole series</button>
          <button type="button" className={POPUP_OPTION} onClick={() => setStep("season")} disabled={seasons.length === 0}>A season</button>
          <button type="button" className={POPUP_OPTION} onClick={() => setStep("episode")} disabled={seasons.length === 0}>An episode</button>
        </div>
      ) : (
        <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
          {seasons.map((n) => (
            <li key={n}>
              <button type="button" className="w-full rounded-xl bg-white/10 py-2 text-sm text-white" onClick={() => (step === "season" ? (setSeason(n), setStep("when")) : onEpisodeSeason(n))}>
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-center"><button type="button" className={POPUP_SECONDARY} onClick={onClose}>Cancel</button></div>
    </Popup>
  );
}
