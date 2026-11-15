// components/LogMenu.tsx
// The + on a show: choose the whole series, a season or an episode, then log it today or open the form.
"use client";

import { useState } from "react";
import Popup, { POPUP_SECONDARY } from "@/components/Popup";
import WhenPopup from "@/components/WhenPopup";

interface Props {
  seasons: number[];
  busy?: boolean;
  /** `season` is null for the whole series; `today` is false when the form should open. */
  onLog: (season: number | null, today: boolean) => void;
  /** Episodes are picked from the season's own page. */
  onEpisodeSeason: (season: number) => void;
  onClose: () => void;
}

export default function LogMenu({ seasons, busy, onLog, onEpisodeSeason, onClose }: Props) {
  const [step, setStep] = useState<"pick" | "season" | "episode" | "when">("pick");
  const [season, setSeason] = useState<number | null>(null);

  if (step === "when") {
    return <WhenPopup what={season === null ? "the whole series" : `Season ${season}`} busy={busy} onToday={() => onLog(season, true)} onForm={() => onLog(season, false)} onClose={onClose} />;
  }

  return (
    <Popup title={step === "pick" ? "Log what?" : step === "season" ? "Which season?" : "Episode from which season?"} icon="plus" onClose={onClose}>
      {step === "pick" ? (
        <div className="flex flex-col gap-2">
          <button type="button" className={POPUP_SECONDARY} onClick={() => { setSeason(null); setStep("when"); }}>Whole series</button>
          <button type="button" className={POPUP_SECONDARY} onClick={() => setStep("season")} disabled={seasons.length === 0}>A season</button>
          <button type="button" className={POPUP_SECONDARY} onClick={() => setStep("episode")} disabled={seasons.length === 0}>An episode</button>
        </div>
      ) : (
        <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
          {seasons.map((n) => (
            <li key={n}>
              <button type="button" className={`${POPUP_SECONDARY} w-full`} onClick={() => (step === "season" ? (setSeason(n), setStep("when")) : onEpisodeSeason(n))}>
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popup>
  );
}
