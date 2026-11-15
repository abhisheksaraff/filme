// components/MonthPicker.tsx
// A popup with two rolling wheels, month and year, for jumping the calendar to any month.
"use client";

import { useState } from "react";
import Popup, { POPUP_PRIMARY, POPUP_SECONDARY } from "@/components/Popup";
import Wheel from "@/components/Wheel";
import { MONTH_NAMES } from "@/lib/domain/stats";

const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;

interface Props {
  month: number;
  year: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
}

export default function MonthPicker({ month, year, onPick, onClose }: Props) {
  // Any year from 1900 to 2100, so past and future dates are always reachable.
  const from = FIRST_YEAR;
  const to = LAST_YEAR;
  const years = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  const [pickedMonth, setPickedMonth] = useState(month);
  const [pickedYear, setPickedYear] = useState(year - from);

  return (
    <Popup
      title="Go to month"
      onClose={onClose}
      actions={
        <>
          <button type="button" className={POPUP_PRIMARY} onClick={() => onPick(from + pickedYear, pickedMonth)}>Go</button>
          <button type="button" className={POPUP_SECONDARY} onClick={onClose}>Cancel</button>
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
