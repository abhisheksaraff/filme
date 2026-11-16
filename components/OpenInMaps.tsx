// components/OpenInMaps.tsx
// An address that opens a map at the place (not directions). Apple devices offer Apple Maps or Google Maps; others go to Google Maps.
"use client";

import { useState } from "react";
import Popup, { POPUP_OPTION, PopupAction } from "@/components/Popup";

interface Props {
  /** Extra classes for the address text, such as a smaller size where space is short. */
  className?: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

const onApple = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function OpenInMaps({ name, address, latitude, longitude, className = "text-sm text-neutral-600 dark:text-neutral-400" }: Props) {
  const [choosing, setChoosing] = useState(false);
  // Coordinates pin the exact spot; without them the name and address are searched.
  const place = latitude !== null && longitude !== null ? `${latitude},${longitude}` : [name, address].join(", ");
  const google = latitude !== null && longitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  const apple = latitude !== null && longitude !== null
    ? `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(name)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(place)}`;

  function open() {
    if (onApple() && navigator.maxTouchPoints > 0) setChoosing(true);
    else window.open(google, "_blank", "noopener");
  }

  return (
    <>
      <button type="button" onClick={open} className={`min-w-0 max-w-full truncate text-left underline decoration-neutral-300 underline-offset-4 ${className}`}>
        {address}
      </button>
      {choosing && (
        <Popup title="Open in Maps" onClose={() => setChoosing(false)}>
          <div className="flex flex-col">
            <a href={apple} onClick={() => setChoosing(false)} className={POPUP_OPTION}>Apple Maps</a>
            <a href={google} target="_blank" rel="noopener" onClick={() => setChoosing(false)} className={POPUP_OPTION}>Google Maps</a>
          </div>
          <div className="flex justify-center"><PopupAction icon="close" label="Close" tone="cancel" onClick={() => setChoosing(false)} /></div>
        </Popup>
      )}
    </>
  );
}
