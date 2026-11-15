// components/WhenPopup.tsx
// After choosing what to log: record it as watched today in one tap, or open the form to set the date and details.
"use client";

import Popup, { POPUP_OPTION, POPUP_SECONDARY } from "@/components/Popup";

interface Props {
  /** What is being logged, such as "Season 2". */
  what: string;
  busy?: boolean;
  onToday: () => void;
  onForm: () => void;
  /** Logs it with no date, for something watched long ago. */
  onUndated?: () => void;
  onClose: () => void;
}

export default function WhenPopup({ what, busy, onToday, onForm, onUndated, onClose }: Props) {
  return (
    <Popup title={`Log ${what}`} onClose={() => !busy && onClose()}>
      <div className="flex flex-col">
        <button type="button" className={POPUP_OPTION} onClick={onToday} disabled={busy}>Today</button>
        <button type="button" className={POPUP_OPTION} onClick={onForm} disabled={busy}>Choose a date</button>
        {onUndated && <button type="button" className={POPUP_OPTION} onClick={onUndated} disabled={busy}>Watched before</button>}
      </div>
      <div className="flex justify-end"><button type="button" className={POPUP_SECONDARY} onClick={onClose} disabled={busy}>Close</button></div>
    </Popup>
  );
}
