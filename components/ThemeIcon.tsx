// components/ThemeIcon.tsx
// One small coloured illustration per theme, drawn on a 32px grid in a shared style: flat colour, one highlight, rounded shapes.
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  plain: (
    <>
      <rect x="6" y="6" width="20" height="20" rx="6" fill="#d4d4d4" />
      <rect x="10" y="10" width="12" height="12" rx="3.5" fill="#f5f5f5" />
    </>
  ),
  auto: (
    <>
      <rect x="5" y="7" width="22" height="20" rx="4" fill="#f1f1f1" stroke="#cfcfcf" />
      <path d="M5 11a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v2H5z" fill="#e5484d" />
      <rect x="10" y="4" width="2.4" height="6" rx="1.2" fill="#555" />
      <rect x="19.6" y="4" width="2.4" height="6" rx="1.2" fill="#555" />
      <circle cx="16" cy="20" r="2.4" fill="#e5484d" />
    </>
  ),
  "new-year": (
    <>
      <g stroke="#f5b400" strokeWidth="2" strokeLinecap="round">
        <path d="M16 4v5M16 23v5M4 16h5M23 16h5M7.5 7.5l3.5 3.5M21 21l3.5 3.5M24.5 7.5L21 11M11 21l-3.5 3.5" />
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#ffd54a" />
      <circle cx="24" cy="5" r="1.4" fill="#ff7aa8" />
      <circle cx="6" cy="26" r="1.4" fill="#7cc4ff" />
    </>
  ),
  valentines: (
    <>
      <path d="M16 27S4.5 20 4.5 12a6 6 0 0 1 11.5-2.4A6 6 0 0 1 27.5 12C27.5 20 16 27 16 27z" fill="#ff4d7d" />
      <path d="M9 10.5a3 3 0 0 1 3-2.5" stroke="#ffc2d3" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "lunar-new-year": (
    <>
      <rect x="14.8" y="2" width="2.4" height="4" fill="#c9971c" />
      <rect x="11" y="6" width="10" height="2.6" rx="1.3" fill="#f2b632" />
      <ellipse cx="16" cy="16" rx="9" ry="8" fill="#e23b2e" />
      <path d="M16 8v16M11 9c-2.5 4-2.5 10 0 14M21 9c2.5 4 2.5 10 0 14" stroke="#b8261c" strokeWidth="1.3" fill="none" />
      <rect x="11" y="23.4" width="10" height="2.6" rx="1.3" fill="#f2b632" />
      <path d="M14.5 26h3l-.5 4h-2z" fill="#f2b632" />
    </>
  ),
  "st-patricks": (
    <>
      <g fill="#2fb560">
        <circle cx="16" cy="9.5" r="5" />
        <circle cx="9.5" cy="15.5" r="5" />
        <circle cx="22.5" cy="15.5" r="5" />
        <circle cx="16" cy="20" r="4" />
      </g>
      <path d="M16 17c0 5 2 8 5 11" stroke="#1d7f40" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="15" r="1.6" fill="#7be59d" />
    </>
  ),
  easter: (
    <>
      <path d="M16 3c6 0 10 9 10 15a10 10 0 0 1-20 0C6 12 10 3 16 3z" fill="#b79cff" />
      <path d="M6.4 15.5l3.2 2 3.2-2 3.2 2 3.2-2 3.2 2 3.2-2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <circle cx="12" cy="22" r="1.5" fill="#ffd54a" />
      <circle cx="17" cy="23.5" r="1.5" fill="#7ce0c3" />
      <circle cx="21" cy="21" r="1.5" fill="#ff8fb1" />
    </>
  ),
  "eid-al-fitr": (
    <>
      <path d="M20 5a11 11 0 1 0 7 19A9 9 0 0 1 20 5z" fill="#f5c14b" />
      <path d="M23 9l1 2.3 2.4.2-1.8 1.6.6 2.4-2.2-1.3-2.2 1.3.6-2.4-1.8-1.6 2.4-.2z" fill="#ffe08a" />
    </>
  ),
  "eid-al-adha": (
    <>
      <path d="M16 2l4 5h-8z" fill="#c9971c" />
      <path d="M10 7h12l-1 3H11z" fill="#f2b632" />
      <path d="M11 10h10l2 6-2 8H11l-2-8z" fill="#1a9e8f" />
      <path d="M13 12h6l1 4-1 6h-6l-1-6z" fill="#ffd77a" />
      <path d="M11 24h10l-1 3h-8z" fill="#f2b632" />
      <path d="M15 27h2v3h-2z" fill="#c9971c" />
    </>
  ),
  "canada-day": (
    <path d="M16 3l2 4 2.5-1-1 6 3.5-3 1 2.5 3.5-1-1.5 4.5 1.5 1-6 4.5.7 2.5-5.2-.8V28h-2v-4.8l-5.2.8.7-2.5-6-4.5 1.5-1L3.5 10.5l3.5 1 1-2.5 3.5 3-1-6L13 7z" fill="#e5322d" />
  ),
  birthday: (
    <>
      <rect x="5" y="15" width="22" height="12" rx="3" fill="#ffb3cf" />
      <path d="M5 19c2.5 2 5-1.5 7.3 0s4.9 1.5 7.3 0 5-1.5 7.4 0" stroke="#fff" strokeWidth="2" fill="none" />
      <rect x="5" y="23" width="22" height="4" rx="2" fill="#ff8fb1" />
      <rect x="14.8" y="8" width="2.4" height="7" rx="1" fill="#7cc4ff" />
      <path d="M16 3c1.6 1.8 1.6 3.4 0 4.4-1.6-1-1.6-2.6 0-4.4z" fill="#ffb300" />
    </>
  ),
  diwali: (
    <>
      <path d="M16 4c3 3.5 3 7.5 0 10-3-2.5-3-6.5 0-10z" fill="#ffb300" />
      <path d="M16 8c1.3 1.6 1.3 3.4 0 4.6-1.3-1.2-1.3-3 0-4.6z" fill="#fff1b8" />
      <path d="M3 18c1 6 6.5 9 13 9s12-3 13-9z" fill="#e8742a" />
      <path d="M3 18h26" stroke="#b24d12" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="22" r="1.3" fill="#ffd54a" />
      <circle cx="16" cy="23.5" r="1.3" fill="#ffd54a" />
      <circle cx="22" cy="22" r="1.3" fill="#ffd54a" />
    </>
  ),
  halloween: (
    <>
      <path d="M15 6c0-2 1-3 3-3" stroke="#3f8f3a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <ellipse cx="11" cy="17.5" rx="7" ry="9" fill="#f57c1f" />
      <ellipse cx="21" cy="17.5" rx="7" ry="9" fill="#f57c1f" />
      <ellipse cx="16" cy="17.5" rx="6" ry="10" fill="#ff9a3c" />
      <path d="M10 14l3 2.5h-3.5zM22 14l-3 2.5h3.5zM10 21c2 1.8 4 .2 6 1.6s4 .4 6-1.6c-1 3.5-3.5 4.5-6 4.5s-5-1-6-4.5z" fill="#4a2408" />
    </>
  ),
  hanukkah: (
    <>
      <g stroke="#2f6fdb" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M16 12v14M10 26h12" />
        <path d="M4 12c0 7 5 9 12 9s12-2 12-9M8 12c0 4.5 3.5 6 8 6s8-1.5 8-6M12 12c0 2.5 1.5 3.4 4 3.4s4-.9 4-3.4" />
      </g>
      <g fill="#ffb300">
        {[4, 8, 12, 20, 24, 28].map((x) => <path key={x} d={`M${x} 6c1 1 1 2.5 0 3-1-.5-1-2 0-3z`} />)}
        <path d="M16 4c1 1 1 2.5 0 3-1-.5-1-2 0-3z" />
      </g>
    </>
  ),
  christmas: (
    <>
      <path d="M16 5l6 8h-3l5 7h-3.5l5 6h-19l5-6H8l5-7h-3z" fill="#2c9c5a" />
      <rect x="14.5" y="26" width="3" height="4" fill="#8a5a2b" />
      <path d="M16 1.5l1 2.2 2.4.2-1.8 1.6.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.8-1.6 2.4-.2z" fill="#ffd54a" />
      <circle cx="13" cy="15" r="1.3" fill="#e5322d" />
      <circle cx="19" cy="19" r="1.3" fill="#ffd54a" />
      <circle cx="12.5" cy="23" r="1.3" fill="#7cc4ff" />
      <circle cx="20" cy="24" r="1.3" fill="#e5322d" />
    </>
  ),
};

/** `plain` and `auto` are the two choices that are not themes; every theme slug has its own picture. */
export default function ThemeIcon({ slug, size = 28 }: { slug: string; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="shrink-0">
      {ICONS[slug] ?? ICONS.plain}
    </svg>
  );
}
