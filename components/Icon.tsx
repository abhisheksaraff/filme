// components/Icon.tsx
// The app's icon set, drawn as simple outlines that can also be filled for a selected state.
import type { ReactNode } from "react";

export type IconName =
  | "home" | "calendar" | "ticket" | "bookmark" | "plus" | "close" | "download" | "upload" | "star"
  | "note" | "trash" | "edit" | "filter" | "shuffle" | "refresh" | "database" | "watch" | "sliders" | "image" | "bell" | "archive"
  | "calendarPlus" | "check" | "back" | "search" | "user" | "undo" | "open" | "sparkle" | "globe" | "chart"
  | "map" | "film" | "mic" | "masks" | "tv" | "stubUpload" | "clock" | "sortNew" | "sortOld" | "sortHigh" | "sortLow" | "minus" | "palette" | "key" | "folder" | "logout" | "left" | "right" | "layers" | "posterFrame" | "coverFrame" | "none" | "eye" | "sound" | "mute";

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
    // A speaker with sound waves, and the same speaker crossed out for muted.
    sound: (
      <>
        <path fill={fill} d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
        <path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ),
    mute: (
      <>
        <path fill={fill} d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      </>
    ),
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
    // A globe turned to show India in the middle, the land plotted from coastline coordinates. Outlines when unselected, filled when selected.
    map: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path strokeWidth="0.7" fill={filled ? "currentColor" : "none"} d="M5.3 7.4L5.9 6.7L6.3 6.7L6.4 6.4L6.9 6.3L7.4 6.2L7.7 5.9L7.9 5.9L8.0 5.6L8.6 5.4L9.3 5.1L9.8 5.1L10.0 5.3L10.0 5.6L10.3 5.6L11.1 5.6L11.7 5.3L12.1 5.3L12.7 4.9L13.3 5.1L14.0 5.0L14.6 4.8L15.0 4.6L15.5 4.6L16.2 5.3L16.6 5.5L17.2 6.2L16.1 5.7L15.9 5.9L16.2 6.5L17.0 7.0L17.2 7.8L16.9 8.0L17.3 9.0L17.1 9.0L16.9 8.7L16.5 8.5L16.6 8.9L17.0 9.7L17.1 10.5L16.9 11.0L16.2 11.4L15.7 11.8L16.2 12.8L15.8 13.3L15.1 12.8L15.1 13.5L15.5 14.4L15.1 13.8L14.8 13.6L14.8 12.4L14.2 12.3L13.9 11.8L13.6 11.6L13.2 11.8L13.0 12.1L12.3 12.7L12.3 13.5L11.9 13.7L11.4 13.2L11.2 11.8L10.7 11.5L10.4 11.2L9.8 11.2L9.3 11.0L9.2 10.8L8.7 10.6L8.6 10.3L8.3 10.3L8.5 10.8L8.6 11.1L9.2 10.9L9.4 11.4L9.6 11.6L9.1 12.1L8.5 12.3L7.5 12.6L7.3 12.5L7.1 11.3L6.9 10.1L7.0 9.7L7.4 9.1L6.9 8.9L6.8 8.7L6.9 8.3L7.2 8.2L7.2 8.1L6.8 8.2L6.5 8.6L6.5 8.2L6.6 7.8L6.7 7.3L6.6 7.3L6.4 8.0L6.2 8.2L6.3 7.6L6.4 7.3L6.1 7.2L5.5 7.6L5.3 7.6z M6.9 9.7L6.8 10.1L6.9 11.1L6.9 12.0L7.3 12.7L8.3 12.9L7.8 13.8L7.1 14.6L6.9 15.6L7.0 16.2L6.8 17.1L6.8 17.6L6.6 17.9L6.2 17.8L5.7 17.2L4.9 15.9L4.4 13.9L4.2 13.0L4.0 12.1L3.7 11.5L3.9 9.8L4.2 8.9L4.6 8.2L5.2 7.6L5.8 8.1L5.5 8.6L5.9 9.2L6.3 9.3z M7.7 17.5L8.1 17.6L8.2 16.5L8.0 16.1L7.5 16.6z M12.3 13.5L12.6 13.8L12.4 14.0L12.3 14.0L12.3 13.7z M14.4 14.0L14.9 14.1L15.7 14.7L15.9 15.3L15.4 15.2L14.7 14.6z M16.3 14.2L16.8 13.9L17.2 13.3L17.5 13.5L17.4 14.1L17.2 14.8L16.4 14.8z M15.8 15.4L16.2 15.4L16.9 15.3L16.9 15.5L15.9 15.5z M17.7 9.5L17.9 9.0L18.1 8.6L17.9 8.2L17.6 7.8L17.3 7.3L17.5 7.7L17.7 8.3L17.7 8.7L17.6 9.0z M16.6 17.1L16.1 18.3L16.4 18.3L17.1 18.0L17.8 17.5L18.0 17.7L17.9 17.9L18.1 17.8L18.4 17.5L19.2 16.4L19.4 16.0L19.4 15.6L19.4 14.7L19.2 15.6L19.0 15.1L18.6 15.3L18.1 15.8L17.6 16.3z M18.7 13.9L19.3 13.7L19.7 13.8L19.9 14.2L19.5 14.4L19.2 14.5L19.0 14.1z" />
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
