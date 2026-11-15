// components/WhenPopup.tsx
// After choosing what to log: record it as watched today in one tap, or open the form to set the date and details.
"use client";

import Icon from "@/components/Icon";
import Popup, { POPUP_PRIMARY, POPUP_SECONDARY } from "@/components/Popup";

interface Props {
  /** What is being logged, such as "Season 2". */
  what: string;
  busy?: boolean;
  onToday: () => void;
  onForm: () => void;
  onClose: () => void;
}

export default function WhenPopup({ what, busy, onToday, onForm, onClose }: Props) {
  return (
    <Popup title={`Log ${what}`} icon="plus" onClose={() => !busy && onClose()}>
      <div className="flex flex-col gap-2">
        <button type="button" className={POPUP_PRIMARY} onClick={onToday} disabled={busy}>
          <Icon name="check" size={18} />
          Watched today
        </button>
        <button type="button" className={POPUP_SECONDARY} onClick={onForm} disabled={busy}>
          <Icon name="calendar" size={18} />
          Pick a date and details
        </button>
      </div>
    </Popup>
  );
}
