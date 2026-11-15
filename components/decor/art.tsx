// components/decor/art.tsx
// The drawings used by theme backgrounds and accents. Flat colour, rounded shapes, one highlight; each is an inline SVG.
import { MORE_ACCENTS } from "./charms";
import type { CSSProperties, ReactNode } from "react";

const svg = (viewBox: string, children: ReactNode, size: number, className?: string) => (
  <svg viewBox={viewBox} width={size} height={size} aria-hidden className={className}>{children}</svg>
);

export const Snowflake = ({ size = 18 }: { size?: number }) =>
  svg("0 0 24 24", (
    <g stroke="#a9cdf2" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
      <path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2" fill="none" />
    </g>
  ), size);

export const Petal = ({ size = 16, color = "#ff7aa8" }: { size?: number; color?: string }) =>
  svg("0 0 32 32", <path d="M16 27S4.5 20 4.5 12a6 6 0 0 1 11.5-2.4A6 6 0 0 1 27.5 12C27.5 20 16 27 16 27z" fill={color} />, size);

export const Balloon = ({ size = 40, color = "#ff5c8a" }: { size?: number; color?: string }) =>
  svg("0 0 32 48", (
    <>
      <path d="M16 3c7 0 11 6 11 12 0 7-6 12-11 14-5-2-11-7-11-14C5 9 9 3 16 3z" fill={color} />
      <path d="M10 10c1-2.4 3-3.6 5-3.8" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M14.5 29h3l-1.5 3z" fill={color} />
      <path d="M16 32c-2 4 2 6 0 10" stroke="#8a8a8a" strokeWidth="1" fill="none" />
    </>
  ), size);

export const Lantern = ({ size = 52 }: { size?: number }) =>
  svg("0 0 32 48", (
    <>
      <path d="M16 0v8" stroke="#c9971c" strokeWidth="1.4" />
      <rect x="11" y="8" width="10" height="3" rx="1.5" fill="#f2b632" />
      <ellipse cx="16" cy="22" rx="12" ry="11" fill="#e23b2e" />
      <path d="M16 11v22M10 12c-3 6-3 14 0 20M22 12c3 6 3 14 0 20" stroke="#b8261c" strokeWidth="1.2" fill="none" />
      <path d="M8 16c1-2 3-3.4 5-4" stroke="#ff8a80" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <rect x="11" y="32" width="10" height="3" rx="1.5" fill="#f2b632" />
      <path d="M13 35l-1 11M16 35v12M19 35l1 11" stroke="#f2b632" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ), size);

export const Moon = ({ size = 56 }: { size?: number }) =>
  svg("0 0 32 32", (
    <>
      <path d="M20 4a12 12 0 1 0 8 20A10 10 0 0 1 20 4z" fill="#f5c14b" />
      <circle cx="12" cy="16" r="1.6" fill="#e0a92e" />
      <circle cx="16" cy="23" r="1.1" fill="#e0a92e" />
    </>
  ), size);

export const Cloud = ({ size = 90, tone = "#dfe7f2" }: { size?: number; tone?: string }) => (
  <svg viewBox="0 0 64 28" width={size} height={size * 0.44} aria-hidden>
    <path d="M14 26a9 9 0 0 1 0-18 13 13 0 0 1 25-3 11 11 0 0 1 15 10 8 8 0 0 1-2 11z" fill={tone} />
  </svg>
);

export const Star = ({ size = 10, color = "#ffe08a" }: { size?: number; color?: string }) =>
  svg("0 0 24 24", <path d="M12 1l2.6 7.4L22 12l-7.4 3.6L12 23l-2.6-7.4L2 12l7.4-3.6z" fill={color} />, size);

export const Sleigh = ({ size = 150 }: { size?: number }) => (
  <svg viewBox="0 0 120 56" width={size} height={size * 0.47} aria-hidden>
    <g fill="#8a5a2b">
      <path d="M4 30c6-4 12-3 15 2l3 9c-4 1-8-.5-10-3z" />
      <path d="M0 28c0-3 3-5 6-3" stroke="#8a5a2b" strokeWidth="2" fill="none" />
    </g>
    <path d="M10 40h58l-6 9H16z" fill="#c9971c" />
    <path d="M12 24h52l4 16H14z" fill="#e5322d" />
    <circle cx="52" cy="17" r="7" fill="#f6d2b0" />
    <path d="M45 14c0-6 5-9 10-8l4 3-3 4z" fill="#e5322d" />
    <circle cx="60" cy="9" r="2" fill="#fff" />
    <path d="M44 17c1 6 5 7 8 7s6-2 7-6c-4 2-10 2-15-1z" fill="#fff" />
    <g fill="#7a4a21">
      <ellipse cx="96" cy="30" rx="12" ry="7" />
      <path d="M104 26l8-9-3-1-7 6zM110 14l-4-6M110 14l4-5" stroke="#7a4a21" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="112" cy="21" r="5" />
      <path d="M86 36l-3 14M92 37l-1 13M100 37l2 13M106 35l4 13" stroke="#7a4a21" strokeWidth="2.6" strokeLinecap="round" />
    </g>
    <circle cx="116" cy="22" r="1.6" fill="#e5322d" />
    <path d="M68 32c8-2 14-2 18-1" stroke="#c9971c" strokeWidth="1.4" fill="none" />
  </svg>
);

export const Dracula = ({ size = 84 }: { size?: number }) =>
  svg("0 0 48 64", (
    <>
      <path d="M8 62L4 26c0-6 8-10 20-10s20 4 20 10l-4 36z" fill="#16161d" />
      <path d="M14 62l-3-30 13 4 13-4-3 30z" fill="#a31621" />
      <path d="M12 20l6 14-6-2zM36 20l-6 14 6-2z" fill="#16161d" />
      <ellipse cx="24" cy="18" rx="8.5" ry="10" fill="#e9e6d9" />
      <path d="M15.5 14c2-6 5-8 8.5-7 3.5-1 6.500 1 8.500 7-3-2-5-3-8.500-1-3.500-2-5.500-1-8.500 1z" fill="#16161d" />
      <path d="M24 9l-3.500 5h7z" fill="#16161d" />
      <circle cx="20.500" cy="17.500" r="1.300" fill="#d9232d" />
      <circle cx="27.500" cy="17.500" r="1.300" fill="#d9232d" />
      <path d="M20.500 23.500c2 1.500 5 1.500 7 0" stroke="#7a1b22" strokeWidth="1.200" fill="none" strokeLinecap="round" />
      <path d="M21.500 24l.8 2.800.8-2.500zM25.700 24.300l.8 2.500.8-2.800z" fill="#fff" />
    </>
  ), size);

export const Wolf = ({ size = 96 }: { size?: number }) => (
  <svg viewBox="0 0 96 64" width={size} height={size * 0.67} aria-hidden>
    <path d="M10 28c-6-2-8-8-6-14 5 2 9 6 12 12z" fill="#6c7280" />
    <ellipse cx="42" cy="32" rx="26" ry="13" fill="#7d8494" />
    <ellipse cx="40" cy="38" rx="20" ry="7" fill="#aab1bf" />
    <g stroke="#5c6270" strokeWidth="5" strokeLinecap="round">
      <path className="leg leg-a" d="M24 40v14M60 40v14" />
      <path className="leg leg-b" d="M34 40v14M52 40v14" />
    </g>
    <circle cx="72" cy="24" r="12" fill="#7d8494" />
    <path d="M78 22l16 6-3 7-16-3z" fill="#98a0b0" />
    <path d="M91 28l3-1 1 3-2 1z" fill="#16161d" />
    <path d="M64 16l-1-12 9 8zM74 13l5-9 3 11z" fill="#6c7280" />
    <circle cx="75" cy="22" r="1.800" fill="#ffd54a" />
    <circle cx="75.500" cy="22" r=".8" fill="#16161d" />
  </svg>
);

export const Monster = ({ size = 76 }: { size?: number }) =>
  svg("0 0 48 56", (
    <>
      <path d="M12 8L8 0l9 5zM36 8l4-8-9 5z" fill="#3b8f5a" />
      <rect x="6" y="6" width="36" height="38" rx="14" fill="#56c27a" />
      <path d="M12 12c3-3 7-4 11-4" stroke="#8be0a8" strokeWidth="2.400" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="22" r="9" fill="#fff" />
      <circle cx="24" cy="22" r="4.500" fill="#2b2b3a" />
      <circle cx="22.500" cy="20.500" r="1.400" fill="#fff" />
      <path d="M13 34c4 4 18 4 22 0" fill="#2b2b3a" />
      <path d="M16 34l2 4 2-3 3 4 2-4 3 3 2-3 2 4" stroke="#fff" strokeWidth="1.600" fill="none" strokeLinejoin="round" />
      <path d="M8 38c-6 2-7 8-4 12M40 38c6 2 7 8 4 12" stroke="#56c27a" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M14 44v10M34 44v10" stroke="#3b8f5a" strokeWidth="6" strokeLinecap="round" />
    </>
  ), size);

export const Bat = ({ size = 28 }: { size?: number }) =>
  svg("0 0 32 20", <path d="M16 18l-3-5-6 4 2-6-8-2 7-3-3-6 7 3 4-3 4 3 7-3-3 6 7 3-8 2 2 6-6-4z" fill="#2a2038" />, size);

const piece = (viewBox: string, body: ReactNode) => ({ viewBox, body });

/** Small accent pieces for beside a page title, drawn on a 48px grid. */
export const ACCENTS: Record<string, { viewBox: string; body: ReactNode }> = {
  ...MORE_ACCENTS,
  snowman: piece("0 0 48 48", (
    <>
      <circle cx="24" cy="34" r="11" fill="#f4f8ff" stroke="#c9d6ea" />
      <circle cx="24" cy="17" r="8" fill="#f4f8ff" stroke="#c9d6ea" />
      <path d="M14 11h20" stroke="#333" strokeWidth="3" strokeLinecap="round" />
      <rect x="18" y="3" width="12" height="8" rx="1.500" fill="#333" />
      <path d="M24 18l5 1.500-5 1z" fill="#ff8a2a" />
      <circle cx="21" cy="15" r="1.200" fill="#333" />
      <circle cx="27" cy="15" r="1.200" fill="#333" />
      <path d="M16 24h16" stroke="#e5322d" strokeWidth="3.500" strokeLinecap="round" />
    </>
  )),
  snowglobe: piece("0 0 48 48", (
    <>
      <circle cx="24" cy="21" r="15" fill="#d8eeff" stroke="#9cc7ea" strokeWidth="1.500" />
      <path d="M17 30l7-13 7 13z" fill="#2c8a4f" />
      <g fill="#fff"><circle cx="15" cy="16" r="1.400" /><circle cx="31" cy="13" r="1.200" /><circle cx="29" cy="24" r="1.400" /><circle cx="19" cy="10" r="1" /></g>
      <path d="M12 36h24l-3 7H15z" fill="#a8683a" />
    </>
  )),
  wreath: piece("0 0 48 48", (
    <>
      <circle cx="24" cy="24" r="15" fill="none" stroke="#2c8a4f" strokeWidth="8" />
      <circle cx="24" cy="24" r="15" fill="none" stroke="#3fae66" strokeWidth="3" strokeDasharray="4 5" />
      <g fill="#e5322d"><circle cx="13" cy="17" r="2.200" /><circle cx="35" cy="20" r="2.200" /><circle cx="20" cy="38" r="2.200" /></g>
      <path d="M18 9l6 4 6-4-1 7h-10z" fill="#e5322d" />
    </>
  )),
  cupid: piece("0 0 48 48", (
    <>
      <path d="M24 40S9 31 9 20a7.500 7.500 0 0 1 15-3 7.500 7.500 0 0 1 15 3c0 11-15 20-15 20z" fill="#ff4d7d" />
      <path d="M5 38L43 10" stroke="#c9971c" strokeWidth="2.200" strokeLinecap="round" />
      <path d="M43 10l-6 .5 2 3.500z" fill="#c9971c" />
      <path d="M5 38l2-5M5 38l5-2" stroke="#c9971c" strokeWidth="2" strokeLinecap="round" />
    </>
  )),
  egg: piece("0 0 48 48", (
    <>
      <path d="M24 5c8 0 14 12 14 21a14 14 0 0 1-28 0C10 17 16 5 24 5z" fill="#7ce0c3" />
      <path d="M10.500 22l4.500 3 4.500-3 4.500 3 4.500-3 4.500 3 4.500-3" stroke="#fff" strokeWidth="2.200" fill="none" />
      <g fill="#ffd54a"><circle cx="18" cy="32" r="2" /><circle cx="25" cy="34" r="2" /><circle cx="31" cy="31" r="2" /></g>
    </>
  )),
  litPumpkin: piece("0 0 48 48", (
    <>
      <path d="M23 10c0-3 1.500-5 4.500-5" stroke="#3f8f3a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="17" cy="27" rx="10" ry="13" fill="#f57c1f" />
      <ellipse cx="31" cy="27" rx="10" ry="13" fill="#f57c1f" />
      <ellipse cx="24" cy="27" rx="9" ry="14" fill="#ff9a3c" />
      <path d="M15 22l5 4h-6zM33 22l-5 4h6zM15 31c3 2.600 6 .3 9 2.300s6 .3 9-2.300c-1.400 5-5 6.600-9 6.600s-7.600-1.600-9-6.600z" fill="#ffd54a" className="flame" />
    </>
  )),
  cake: piece("0 0 48 48", (
    <>
      <rect x="8" y="22" width="32" height="18" rx="4" fill="#ffb3cf" />
      <path d="M8 28c3.500 3 7-2 10.600 0s7 2 10.600 0 7-2 10.800 0" stroke="#fff" strokeWidth="3" fill="none" />
      <rect x="15" y="34" width="3" height="1.600" rx=".8" fill="#ffd54a" />
      <rect x="24" y="35" width="3" height="1.600" rx=".8" fill="#62d26f" />
      <rect x="31" y="33" width="3" height="1.600" rx=".8" fill="#c58bff" />
      <rect x="17" y="12" width="2.600" height="10" rx="1" fill="#7cc4ff" />
      <rect x="28.400" y="12" width="2.600" height="10" rx="1" fill="#ffd54a" />
      <path className="flame" d="M18.300 5c1.800 2 1.800 4 0 5-1.800-1-1.800-3 0-5z" fill="#ffb300" />
      <path className="flame" d="M29.700 5c1.800 2 1.800 4 0 5-1.800-1-1.800-3 0-5z" fill="#ffb300" />
    </>
  )),
  beach: piece("0 0 48 48", (
    <>
      <path d="M3 41c7-4 14-4 21 0s14 4 21 0v5H3z" fill="#5cc8ff" />
      <path d="M24 12L18 40" stroke="#8a5a2b" strokeWidth="2.400" strokeLinecap="round" />
      <path d="M6 18a18 12 0 0 1 36 0z" fill="#ff5c5c" />
      <path d="M15 18a9 12 0 0 1 18 0" fill="#fff" />
      <circle cx="38" cy="8" r="4" fill="#ffd54a" />
    </>
  )),
  rocket: piece("0 0 48 48", (
    <>
      <path d="M24 3c7 6 9 15 7 25H17C15 18 17 9 24 3z" fill="#eef2f7" stroke="#c4ccd8" />
      <circle cx="24" cy="16" r="4" fill="#5cc8ff" stroke="#2f6fdb" strokeWidth="1.500" />
      <path d="M17 22l-6 9h7zM31 22l6 9h-7z" fill="#e5322d" />
      <path className="flame" d="M19 29h10c0 7-3 11-5 15-2-4-5-8-5-15z" fill="#ffb300" />
    </>
  )),
  satellite: piece("0 0 48 48", (
    <>
      <rect x="19" y="19" width="10" height="10" rx="2" transform="rotate(45 24 24)" fill="#c4ccd8" />
      <rect x="4" y="9" width="12" height="7" rx="1" transform="rotate(45 10 12.500)" fill="#2f6fdb" />
      <rect x="32" y="32" width="12" height="7" rx="1" transform="rotate(45 38 35.500)" fill="#2f6fdb" />
      <path d="M14 14l20 20" stroke="#8a93a3" strokeWidth="2" />
      <path d="M28 18a6 6 0 0 1 6-6M30 20a10 10 0 0 1 8-8" stroke="#ff8a2a" strokeWidth="1.800" fill="none" strokeLinecap="round" />
    </>
  )),
  planet: piece("0 0 48 48", (
    <>
      <circle cx="24" cy="24" r="12" fill="#c58bff" />
      <path d="M14 20c4 2 14 2 20-2" stroke="#9a5ce6" strokeWidth="2.400" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="26" rx="21" ry="6" fill="none" stroke="#ffd54a" strokeWidth="2.400" transform="rotate(-15 24 26)" />
    </>
  )),
  diya: piece("0 0 48 48", (
    <>
      <path className="flame" d="M24 6c5 6 5 12 0 16-5-4-5-10 0-16z" fill="#ffb300" />
      <path d="M24 12c2 2.400 2 4.600 0 6.400-2-1.800-2-4 0-6.400z" fill="#fff1b8" />
      <path d="M6 28c2 9 9 14 18 14s16-5 18-14z" fill="#e8742a" />
      <path d="M6 28h36" stroke="#b24d12" strokeWidth="2.600" strokeLinecap="round" />
      <g fill="#ffd54a"><circle cx="15" cy="34" r="1.600" /><circle cx="24" cy="36" r="1.600" /><circle cx="33" cy="34" r="1.600" /></g>
    </>
  )),
};

export function Accent({ name, size = 44, style }: { name: string; size?: number; style?: CSSProperties }) {
  const art = ACCENTS[name];
  if (!art) return null;
  return <svg viewBox={art.viewBox} width={size} height={size} aria-hidden style={style}>{art.body}</svg>;
}

export type LightShape = "bulb" | "flag" | "heart" | "star" | "egg";

/** A string of small lights, flags or charms hung in scallops across the width; they twinkle softly, out of step with each other. */
export function LightString({ shape, colors, className = "", flicker = false }: { shape: LightShape; colors: string[]; className?: string; flicker?: boolean }) {
  const W = 360;
  const quad = (t: number, a: number, c: number, b: number) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * b;
  const items: { x: number; y: number; color: string; delay: number }[] = [];
  const SCALLOPS = 4;
  const per = W / SCALLOPS;
  for (let s = 0; s < SCALLOPS; s++) {
    [0.2, 0.5, 0.8].forEach((t, j) => {
      const n = s * 3 + j;
      items.push({
        x: quad(t, s * per, s * per + per / 2, (s + 1) * per),
        y: quad(t, s === 0 ? 6 : 8, 36, s === SCALLOPS - 1 ? 6 : 8),
        color: colors[n % colors.length],
        delay: (n * 0.53) % 3.4,
      });
    });
  }
  const wire = Array.from({ length: SCALLOPS }, (_, s) => `${s === 0 ? "M0 6" : ""} Q${s * per + per / 2} 36 ${(s + 1) * per} ${s === SCALLOPS - 1 ? 6 : 8}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} 52`} width="100%" aria-hidden className={`pointer-events-none ${className}`}>
      <path d={wire} stroke="#6b6b6b" strokeOpacity=".7" strokeWidth="1.300" fill="none" />
      {items.map((item, i) => (
        <g key={i} className={flicker ? "flicker" : "twinkle"} style={{ animationDelay: flicker ? `${(i * 0.13) % 0.5}s` : `${item.delay}s` }} transform={`translate(${item.x} ${item.y})`}>
          {shape === "bulb" && (
            <>
              <rect x="-2" y="-1" width="4" height="4" rx="1" fill="#555" />
              <ellipse cx="0" cy="8" rx="4.400" ry="6.200" fill={item.color} />
              <ellipse cx="-1.400" cy="6" rx="1.100" ry="1.800" fill="#fff" fillOpacity=".55" />
            </>
          )}
          {shape === "flag" && <path d="M-6 0h12l-6 13z" fill={item.color} />}
          {shape === "heart" && <path d="M0 14S-8 8.500-8 4a4 4 0 0 1 8-1.500A4 4 0 0 1 8 4c0 4.500-8 10-8 10z" fill={item.color} />}
          {shape === "star" && <path d="M0 0l2.200 6.200 6.400.2-5 4 1.800 6.200L0 12.800l-5.400 3.800 1.800-6.200-5-4 6.400-.2z" fill={item.color} transform="scale(.8)" />}
          {shape === "egg" && (
            <>
              <path d="M0 0c4 0 7 6 7 10.500a7 7 0 0 1-14 0C-7 6 -4 0 0 0z" fill={item.color} />
              <path d="M-6 8l3 2 3-2 3 2 3-2" stroke="#fff" strokeOpacity=".8" strokeWidth="1.300" fill="none" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/** A leafy garland with baubles, for the bottom of a page. */
export function Garland({ className = "", flicker = false }: { className?: string; flicker?: boolean }) {
  return (
    <svg viewBox="0 0 340 46" width="100%" aria-hidden className={`pointer-events-none ${className}`}>
      <g fill="#2c8a4f">
        {[20, 62, 104, 146, 188, 230, 272, 316].map((x, i) => <ellipse key={x} cx={x} cy={i % 2 ? 20 : 23} rx={24} ry={i % 2 ? 13 : 12} />)}
      </g>
      <g fill="#3fae66">{[40, 124, 208, 292].map((x, i) => <ellipse key={x} cx={x} cy={i % 2 ? 15 : 16} rx="12" ry="6" />)}</g>
      <g>
        {[[30, 30, "#e5322d"], [84, 32, "#ffd54a"], [140, 31, "#e5322d"], [196, 33, "#5cc8ff"], [252, 31, "#ffd54a"], [306, 32, "#e5322d"]].map(([x, y, c]) => <circle key={String(x)} cx={Number(x)} cy={Number(y)} r="5" fill={String(c)} />)}
      </g>
      <g fill="#fff3b0">
        {[[58, 14], [112, 27], [168, 14], [224, 28], [280, 14]].map(([x, y], i) => <circle key={x} cx={x} cy={y} r="2" className={flicker ? "flicker" : "twinkle"} style={{ animationDelay: flicker ? `${i * 0.11}s` : `${i * 0.7}s` }} />)}
      </g>
    </svg>
  );
}
