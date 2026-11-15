// components/Icon.tsx
// The app's icon set, drawn as simple outlines that can also be filled for a selected state.
import type { ReactNode } from "react";

export type IconName =
  | "home" | "calendar" | "ticket" | "bookmark" | "plus" | "close" | "download" | "upload" | "star"
  | "note" | "trash" | "edit" | "filter" | "shuffle" | "refresh" | "database" | "watch" | "sliders" | "image" | "bell" | "archive"
  | "calendarPlus" | "check" | "back" | "search" | "user" | "undo" | "open" | "sparkle" | "globe" | "chart"
  | "map" | "film" | "mic" | "masks" | "tv" | "stubUpload" | "clock" | "sortNew" | "sortOld" | "sortHigh" | "sortLow" | "minus" | "palette" | "key" | "folder" | "logout" | "left" | "right" | "layers" | "posterFrame" | "coverFrame" | "none" | "eye";

interface Props {
  name: IconName;
  size?: number;
  /** Fills the shape in; used for the selected tab. */
  filled?: boolean;
}

export default function Icon({ name, size = 20, filled = false }: Props) {
  const fill = filled ? "currentColor" : "none";
  const paths: Record<IconName, ReactNode> = {
    home: <path fill={fill} d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        {/* Selected: only the part below the horizontal line fills in. */}
        {filled && <path fill="currentColor" d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />}
        <path d="M8 3v4M16 3v4" />
        <path d="M4 10h16" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
        {/* Selected: the left half, up to the tear line, fills in. */}
        {filled && <path fill="currentColor" d="M4 8a2 2 0 0 1 2-2h8v12H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />}
        <path d="M14 6v12" strokeDasharray="2 2" />
      </>
    ),
    bookmark: <path fill={fill} d="M6 4h12v17l-6-4-6 4z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
    upload: <path d="M12 16V5M7 9l5-5 5 5M5 20h14" />,
    star: <path fill={fill} d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7 9.600 9z" />,
    note: <path d="M5 5h14v10l-4 4H5zM9 10h6M9 14h3" />,
    trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
    edit: <path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6" /></>,
    refresh: <path d="M20 11a8 8 0 0 0-14.500-4M4 4v4h4M4 13a8 8 0 0 0 14.500 4M20 20v-4h-4" />,
    shuffle: <path d="M4 7h3c4 0 5 10 9 10h4M4 17h3c1.500 0 2.500-1 3.500-2.500M14 9c.8-1.200 1.800-2 3-2h3M17 4l3 3-3 3M17 14l3 3-3 3" />,
    sliders: <path d="M5 6h8M17 6h2M5 12h2M11 12h8M5 18h10M19 18h0M13 4v4M9 10v4M17 16v4" />,
    image: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.500" />
        <path d="M5 18l5-5 4 4 2-2 4 4" />
      </>
    ),
    bell: <path fill={fill} d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15zM10 21h4" />,
    archive: <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" />,
    calendarPlus: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M12 11v6M9 14h6" />
      </>
    ),
    check: <path d="M5 12.500l4.500 4.500L19 7" />,
    back: <path d="M15 5l-7 7 7 7" />,
    left: <path d="M15 5l-7 7 7 7" />,
    right: <path d="M9 5l7 7-7 7" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </>
    ),
    undo: <path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12" />,
    open: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
    sparkle: <path fill={fill} d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" />
      </>
    ),
    chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
    eye: <><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="3" /></>,
    none: <><circle cx="12" cy="12" r="8" /><path d="M6.300 17.700L17.700 6.300" /></>,
    // A globe turned to show India in the middle: the land is drawn as outlines and fills in when selected.
    map: (
      <>
        <circle cx="12" cy="12" r="9" />
        <g fill={filled ? "currentColor" : "none"}>
          <path d="M7.500 8.500l3-2.200 4.500.4 2.200 2.300-1.800 1.500h-2l-.8 1.300H9.600L7.800 10z" />
          <path d="M10.200 12h3.600L12.800 15.200 12 17.800l-.8-2.600z" />
          <path d="M5.600 11.200l2-.9.800 2.700-.8 3-1.900-1.700z" />
          <path d="M15 15.600l2.800-.8 1 1.800-2.400.9z" />
        </g>
      </>
    ),
    film: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4" /></>,
    mic: <path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3M9 20h6" />,
    masks: <path d="M4 5h9v6a4.500 4.500 0 0 1-9 0zM7 9h.01M10 9h.01M6.500 12.500c1 1 3 1 4 0M11 8h9v6a4.500 4.500 0 0 1-7 3.700M16 12h.01M19 12h.01" />,
    watch: <><rect x="3" y="4" width="18" height="12" rx="3" /><path d="M10 8l5 2-5 2z" /><path d="M8 20h8M12 16v4" /></>,
    tv: <path d="M4 7h16v11H4zM9 3l3 4 3-4" />,
    stubUpload: <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM12 15V9M9.500 11.500L12 9l2.500 2.500" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    sortNew: <path d="M12 19V5M7 10l5-5 5 5" />,
    sortOld: <path d="M12 5v14M7 14l5 5 5-5" />,
    sortHigh: <path d="M12 4l2.200 4.500 5 .7-3.600 3.500.9 5L12 15.300 7.500 17.700l.9-5L4.800 9.200l5-.7zM3 21h18" />,
    sortLow: <path d="M12 4l2.200 4.500 5 .7-3.600 3.500.9 5L12 15.300 7.500 17.700l.9-5L4.800 9.200l5-.7zM6 21h12" />,
    minus: <path d="M5 12h14" />,
    palette: <path d="M12 4a8 8 0 1 0 0 16c1.500 0 2-1 1.500-2-.5-1.200.2-2.500 1.700-2.500H17a3 3 0 0 0 3-3C20 7 16.500 4 12 4zM8 11h.01M12 8h.01M16 10h.01" />,
    key: <path d="M14 10a4 4 0 1 1-1.500-3.100L20 14l-2 2-1.500-1.500L15 16l-2-2 1-1.500z" />,
    folder: <path d="M4 7a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />,
    logout: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
    layers: <path d="M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />,
    posterFrame: (
      <>
        <rect x="7" y="3" width="10" height="15" rx="1.500" />
        <path d="M9.500 14.500l2-2.500 1.500 1.500 1.500-2 1 1.500" />
      </>
    ),
    coverFrame: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="1.500" />
        <path d="M6 14.500l3-3 2.500 2.500 2-2 3.500 3" />
        <circle cx="16" cy="10.500" r="1" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
