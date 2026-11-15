// components/MonthPicker.tsx
// A popup with two rolling wheels, month and year, for jumping the calendar to any month.
"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import Popup, { POPUP_PRIMARY, POPUP_SECONDARY } from "@/components/Popup";
import Wheel from "@/components/Wheel";
import { MONTH_NAMES } from "@/lib/domain/stats";

interface Props {
  month: number;
  year: number;
  firstYear: number;
  lastYear: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
}

export default function MonthPicker({ month, year, firstYear, lastYear, onPick, onClose }: Props) {
  // The years always include the one on screen, whatever the log says.
  const from = Math.min(firstYear, year);
  const to = Math.max(lastYear, year);
  const years = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  const [pickedMonth, setPickedMonth] = useState(month);
  const [pickedYear, setPickedYear] = useState(year - from);

  return (
    <Popup
      title="Go to month"
      icon="calendar"
      onClose={onClose}
      actions={
        <>
          <button type="button" className={POPUP_SECONDARY} onClick={onClose}>
            <Icon name="close" size={18} />
            Cancel
          </button>
          <button type="button" className={POPUP_PRIMARY} onClick={() => onPick(from + pickedYear, pickedMonth)}>
            <Icon name="check" size={18} />
            Done
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <Wheel label="Month" items={MONTH_NAMES} value={month} onChange={setPickedMonth} />
        <Wheel label="Year" items={years} value={year - from} onChange={setPickedYear} />
      </div>
    </Popup>
  );
}
