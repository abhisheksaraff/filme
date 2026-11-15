// components/decor/charms.tsx
// More small pieces for the festival charms that perch on headings, fields and cards. Each is drawn on a 48px grid
// in flat colours, so they stay crisp at any size and read the same in light and dark.
import type { ReactNode } from "react";

const piece = (body: ReactNode) => ({ viewBox: "0 0 48 48", body });

export const MORE_ACCENTS: Record<string, { viewBox: string; body: ReactNode }> = {
  bow: piece(
    <>
      <path d="M24 24L8 14c-3 5-3 15 0 20z" fill="#e5322d" />
      <path d="M24 24l16-10c3 5 3 15 0 20z" fill="#e5322d" />
      <path d="M24 24L12 17M24 24l12-7M24 24L12 31M24 24l12 7" stroke="#b71c1c" strokeWidth="1.400" />
      <path d="M21 31l-5 13h6l2-9zM27 31l5 13h-6l-2-9z" fill="#c62828" />
      <circle cx="24" cy="24" r="5" fill="#ff6b6b" />
    </>,
  ),
  candycane: piece(
    <>
      <path d="M16 44V17a8 8 0 0 1 16 0" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M16 44V17a8 8 0 0 1 16 0" stroke="#e5322d" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="5 6" />
    </>,
  ),
  stocking: piece(
    <>
      <path d="M14 6h16v22l10 8c2 2 1 6-2 7-3 1-6-1-9-3L16 36c-2-1-2-3-2-5z" fill="#e5322d" />
      <rect x="12" y="4" width="20" height="8" rx="3" fill="#fff" />
      <path d="M33 40c3 2 6 3 8 2 2-1 2-3 1-4l-4-3z" fill="#fff" />
      <circle cx="22" cy="22" r="2" fill="#ffd54a" />
    </>,
  ),
  santahat: piece(
    <>
      <path d="M8 36C8 20 16 8 32 8c4 0 7 2 8 6-6 0-9 4-9 10l1 12z" fill="#e5322d" />
      <rect x="6" y="34" width="36" height="9" rx="4.500" fill="#fff" />
      <circle cx="39" cy="14" r="5" fill="#fff" />
    </>,
  ),
  partyhat: piece(
    <>
      <path d="M24 4l14 38H10z" fill="#c58bff" />
      <path d="M17 24l16 0M14 33h20" stroke="#ffd54a" strokeWidth="3" />
      <path d="M20 14h8" stroke="#5cc8ff" strokeWidth="3" />
      <circle cx="24" cy="5" r="4" fill="#ff5c8a" />
      <ellipse cx="24" cy="42" rx="14" ry="3" fill="#a26be6" />
    </>,
  ),
  gift: piece(
    <>
      <rect x="6" y="20" width="36" height="22" rx="3" fill="#5cc8ff" />
      <rect x="4" y="14" width="40" height="9" rx="3" fill="#2f9be0" />
      <rect x="21" y="14" width="6" height="28" fill="#ffd54a" />
      <path d="M24 14c-4-8-12-6-10-2 1 2 6 2 10 2zM24 14c4-8 12-6 10-2-1 2-6 2-10 2z" fill="#ff5c8a" />
    </>,
  ),
  beachball: piece(
    <>
      <circle cx="24" cy="24" r="18" fill="#fff" />
      <path d="M24 6a18 18 0 0 1 14 7L24 24z" fill="#ff5c5c" />
      <path d="M38 13a18 18 0 0 1 4 15L24 24z" fill="#ffd54a" />
      <path d="M24 24l18 4a18 18 0 0 1-12 12z" fill="#5cc8ff" />
      <path d="M24 24L10 36A18 18 0 0 1 6 20z" fill="#62d26f" />
      <circle cx="24" cy="24" r="3" fill="#fff" />
    </>,
  ),
  ghost: piece(
    <>
      <path d="M9 42V22C9 12 15 6 24 6s15 6 15 16v20l-5-4-5 4-5-4-5 4-5-4z" fill="#f4f6fb" />
      <circle cx="19" cy="22" r="3" fill="#2a2a3a" />
      <circle cx="29" cy="22" r="3" fill="#2a2a3a" />
      <ellipse cx="24" cy="30" rx="3" ry="4" fill="#2a2a3a" />
      <circle cx="14" cy="28" r="2.500" fill="#ffb3cf" fillOpacity=".7" />
      <circle cx="34" cy="28" r="2.500" fill="#ffb3cf" fillOpacity=".7" />
    </>,
  ),
  witchhat: piece(
    <>
      <path d="M24 3c3 8 4 17 6 30H18c2-10 3-19 6-30z" fill="#3b2a5c" />
      <path d="M3 40c6-6 36-6 42 0-6 4-36 4-42 0z" fill="#2c1f47" />
      <path d="M18.500 32h11l1 5h-13z" fill="#ff8a2a" />
      <rect x="22" y="32" width="4" height="5" fill="#ffd54a" />
    </>,
  ),
  bat: piece(
    <>
      <path d="M24 16c3 0 4 3 6 3 2-6 7-9 14-8-3 3-4 6-4 9 2 2 3 5 3 8-3-2-6-2-8 0-1-3-3-5-5-5l-2 6-2-6c-2 0-4 2-5 5-2-2-5-2-8 0 0-3 1-6 3-8 0-3-1-6-4-9 7-1 12 2 14 8 2 0 3-3 6-3z" fill="#3b2a5c" transform="translate(-0 2)" />
      <circle cx="21" cy="19" r="1.300" fill="#ffd54a" />
      <circle cx="27" cy="19" r="1.300" fill="#ffd54a" />
    </>,
  ),
  heart: piece(
    <>
      <path d="M24 42S5 30 5 16c0-6 5-10 10-10 4 0 7 2 9 5 2-3 5-5 9-5 5 0 10 4 10 10 0 14-19 26-19 26z" fill="#ff4d7d" />
      <path d="M12 14c1-3 4-4 6-3" stroke="#fff" strokeOpacity=".7" strokeWidth="2.600" fill="none" strokeLinecap="round" />
    </>,
  ),
  rose: piece(
    <>
      <path d="M24 26v18" stroke="#2c8a4f" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 38c-6-2-9-5-9-7 5 0 8 2 9 7zM24 34c5-2 8-4 9-7-5 0-8 3-9 7z" fill="#3fae66" />
      <path d="M24 5c-8 0-13 6-13 12 0 7 6 11 13 11s13-4 13-11C37 11 32 5 24 5z" fill="#e5322d" />
      <path d="M18 14c2-3 9-3 12 1M17 19c3 4 11 4 14 0M24 11v10" stroke="#b71c1c" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>,
  ),
  bunny: piece(
    <>
      <ellipse cx="17" cy="12" rx="4.500" ry="10" fill="#f4f6fb" />
      <ellipse cx="31" cy="12" rx="4.500" ry="10" fill="#f4f6fb" />
      <ellipse cx="17" cy="13" rx="2" ry="6.500" fill="#ffb3cf" />
      <ellipse cx="31" cy="13" rx="2" ry="6.500" fill="#ffb3cf" />
      <circle cx="24" cy="30" r="14" fill="#f4f6fb" />
      <circle cx="19" cy="28" r="1.800" fill="#2a2a3a" />
      <circle cx="29" cy="28" r="1.800" fill="#2a2a3a" />
      <path d="M22 33h4l-2 2.500z" fill="#ff8fb1" />
      <path d="M24 35.500c-1 2-3 2.500-4 1.500M24 35.500c1 2 3 2.500 4 1.500" stroke="#8a93a3" strokeWidth="1.200" fill="none" strokeLinecap="round" />
    </>,
  ),
  tulip: piece(
    <>
      <path d="M24 24v20" stroke="#2c8a4f" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 42c-8 0-12-7-12-12 7 0 12 5 12 12zM24 42c8 0 12-7 12-12-7 0-12 5-12 12z" fill="#3fae66" />
      <path d="M12 12c0 10 5 15 12 15s12-5 12-15l-6 4-6-8-6 8z" fill="#ff7aa8" />
      <path d="M24 8l-6 8 6 11 6-11z" fill="#ff4d7d" />
    </>,
  ),
  shamrock: piece(
    <>
      <path d="M24 28c-4-14-16-10-13-1 2 6 9 6 13 1z" fill="#2fb560" />
      <path d="M24 28c4-14 16-10 13-1-2 6-9 6-13 1z" fill="#2fb560" />
      <path d="M24 26c-9-2-9-18 0-18s9 16 0 18z" fill="#3fc06f" />
      <path d="M24 26c0 8 2 13 8 17" stroke="#1b7f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>,
  ),
  leprechaunhat: piece(
    <>
      <path d="M12 10h24l2 24H10z" fill="#1b7f3a" />
      <rect x="10" y="26" width="28" height="6" fill="#222" />
      <rect x="20" y="25" width="8" height="8" rx="1" fill="none" stroke="#ffd54a" strokeWidth="2.200" />
      <path d="M2 40c6-8 38-8 44 0-6 4-38 4-44 0z" fill="#16692f" />
    </>,
  ),
  potofgold: piece(
    <>
      <circle cx="16" cy="14" r="5" fill="#ffd54a" />
      <circle cx="26" cy="11" r="5.500" fill="#ffc933" />
      <circle cx="34" cy="15" r="4.500" fill="#ffd54a" />
      <path d="M9 20c0-2 4-4 15-4s15 2 15 4c0 14-3 24-15 24S9 34 9 20z" fill="#2a2a3a" />
      <ellipse cx="24" cy="19" rx="15" ry="4" fill="#3b3b52" />
    </>,
  ),
  mapleleaf: piece(
    <>
    <rect x="22.500" y="34" width="3" height="11" rx="1" fill="#b71c1c" />
    <path d="M24 3l4 9 6-3-2 12 8-5-2 8 4 1-10 8 1 5-9-2v10h-0v-10l-9 2 1-5-10-8 4-1-2-8 8 5-2-12 6 3z" fill="#e5322d" transform="translate(0 -1)" />
    </>,
  ),
  flag: piece(
    <>
      <path d="M12 4v40" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 7h28v22H14z" fill="#fff" stroke="#d9dde5" />
      <path d="M14 7h8v22h-8zM34 7h8v22h-8z" fill="#e5322d" />
      <path d="M28 12l1.500 3 2-1-1 5 3-2-1 4 1.500.5-5 4 .5 2-2-.5-2 .5.500-2-5-4 1.500-.5-1-4 3 2-1-5 2 1z" fill="#e5322d" transform="translate(-1 -2) scale(1.050)" />
    </>,
  ),
  champagne: piece(
    <>
      <path d="M8 6h14l-2 16c-.5 4-2.500 6-5 6s-4.500-2-5-6z" fill="#ffe9a8" fillOpacity=".95" stroke="#d9a73b" strokeWidth="2" />
      <path d="M26 6h14l-2 16c-.5 4-2.500 6-5 6s-4.500-2-5-6z" fill="#ffe9a8" fillOpacity=".95" stroke="#d9a73b" strokeWidth="2" />
      <path d="M15 28v13M33 28v13M9 43h12M27 43h12" stroke="#d9a73b" strokeWidth="2.600" strokeLinecap="round" />
      <circle cx="13" cy="14" r="1.300" fill="#fff" /><circle cx="17" cy="19" r="1.300" fill="#fff" /><circle cx="33" cy="13" r="1.300" fill="#fff" /><circle cx="36" cy="19" r="1.300" fill="#fff" />
    </>,
  ),
  sparkler: piece(
    <>
      <path d="M12 44l14-20" stroke="#8a93a3" strokeWidth="3" strokeLinecap="round" />
      <g stroke="#ffd54a" strokeWidth="2.400" strokeLinecap="round">
        <path d="M27 22l5-9M27 22l11-3M27 22l9 8M27 22l-3-12M27 22l12-9" />
      </g>
      <g fill="#fff3b0"><circle cx="34" cy="10" r="1.800" /><circle cx="40" cy="20" r="1.800" /><circle cx="37" cy="32" r="1.800" /><circle cx="22" cy="8" r="1.800" /></g>
    </>,
  ),
  lantern: piece(
    <>
      <path d="M24 2v6M16 8h16" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="24" rx="15" ry="14" fill="#e23b2e" />
      <path d="M24 10c-6 4-6 24 0 28M24 10c6 4 6 24 0 28" stroke="#b71c1c" strokeWidth="1.800" fill="none" />
      <rect x="18" y="37" width="12" height="4" rx="1" fill="#ffd54a" />
      <path d="M21 41v6M24 41v6M27 41v6" stroke="#ffd54a" strokeWidth="2" strokeLinecap="round" />
    </>,
  ),
  envelope: piece(
    <>
      <rect x="9" y="4" width="30" height="40" rx="4" fill="#d32f2f" />
      <path d="M9 14c9 8 21 8 30 0" stroke="#ffd54a" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="6.500" fill="#ffd54a" />
      <path d="M24 20v8M21 24h6" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" />
    </>,
  ),
  firecrackers: piece(
    <>
      <path d="M24 2v8" stroke="#8a5a2b" strokeWidth="2.400" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${i % 2 ? 26 : 12} ${10 + i * 9})`}>
          <rect width="10" height="11" rx="2" fill="#e5322d" />
          <rect y="4" width="10" height="2.500" fill="#ffd54a" />
          <path d="M5 0l0-3" stroke="#555" strokeWidth="1.300" />
        </g>
      ))}
      <path d="M24 10v26" stroke="#8a5a2b" strokeWidth="1.400" />
    </>,
  ),
  rangoli: piece(
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse key={a} cx="24" cy="12" rx="4" ry="8" fill={a % 90 ? "#ffb300" : "#e5322d"} transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="6" fill="#c58bff" />
      <circle cx="24" cy="24" r="2.500" fill="#fff" />
    </>,
  ),
  crescent: piece(
    <>
      <path d="M30 5a19 19 0 1 0 12 30A15 15 0 0 1 30 5z" fill="#f5c14b" />
      <path d="M38 8l1.800 4 4.200.5-3.200 3 1 4.200-3.800-2.200-3.800 2.200 1-4.200-3.200-3 4.200-.5z" fill="#f5c14b" />
    </>,
  ),
  dreidel: piece(
    <>
      <rect x="22" y="2" width="4" height="8" rx="2" fill="#8a93a3" />
      <path d="M12 12h24l2 14-14 18L10 26z" fill="#3a78d8" />
      <path d="M12 12h24l2 14H10z" fill="#5a9af0" />
      <path d="M21 16h6M24 16v6M20 22h8" stroke="#fff" strokeWidth="2.400" strokeLinecap="round" />
    </>,
  ),
  menorah: piece(
    <>
      <path d="M24 44V20M8 14v6c0 8 6 12 16 12s16-4 16-12v-6" stroke="#d9a73b" strokeWidth="3.200" fill="none" strokeLinecap="round" />
      <path d="M14 44h20" stroke="#d9a73b" strokeWidth="3.200" strokeLinecap="round" />
      {[8, 16, 24, 32, 40].map((x) => (
        <g key={x}>
          <rect x={x - 1.500} y={x === 24 ? 14 : 15} width="3" height="6" fill="#5cc8ff" />
          <path className="flame" d={`M${x} ${x === 24 ? 8 : 9}c2 2 2 4 0 5-2-1-2-3 0-5z`} fill="#ffb300" />
        </g>
      ))}
    </>,
  ),
  star: piece(
    <>
      <path d="M24 3l6 14 15 1.500-11.500 10 3.500 15L24 35.500 11 43.500l3.500-15L3 18.500 18 17z" fill="#ffd54a" />
      <path d="M24 10l3.500 8 9 1-7 6 2 9-7.500-4.500" fill="#ffe9a8" fillOpacity=".6" />
    </>,
  ),
};

/** Which charms each theme may hang on a heading, a field or a card. `icon` is the theme's own picture. */
export const CHARMS: Record<string, string[]> = {
  christmas: ["wreath", "snowman", "snowglobe", "bow", "candycane", "stocking", "santahat", "icon"],
  birthday: ["cake", "partyhat", "gift", "rocket", "satellite", "planet", "beachball", "beach", "icon"],
  halloween: ["litPumpkin", "ghost", "witchhat", "bat", "icon"],
  valentines: ["heart", "rose", "cupid", "icon"],
  easter: ["egg", "bunny", "tulip", "icon"],
  "st-patricks": ["shamrock", "leprechaunhat", "potofgold", "icon"],
  "canada-day": ["mapleleaf", "flag", "icon"],
  "new-year": ["partyhat", "champagne", "sparkler", "rocket", "icon"],
  "lunar-new-year": ["lantern", "envelope", "firecrackers", "icon"],
  diwali: ["diya", "rangoli", "sparkler", "firecrackers", "icon"],
  "eid-al-fitr": ["crescent", "lantern", "star", "icon"],
  "eid-al-adha": ["crescent", "lantern", "star", "icon"],
  hanukkah: ["dreidel", "menorah", "star", "icon"],
};
