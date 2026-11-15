// components/decor/LogoLights.tsx
// A string of twinkling lights, flags or charms in the theme's colours, hung under the logo on Home.
"use client";

import { LightString, type LightShape } from "./art";
import { useDecor } from "./useDecor";

const LIGHTS: Record<string, { shape: LightShape; colors: string[] }> = {
  christmas: { shape: "bulb", colors: ["#ffcf4a", "#ff5c5c", "#62d26f", "#5cc8ff"] },
  halloween: { shape: "bulb", colors: ["#ff8a2a", "#a259ff", "#ff8a2a", "#62d26f"] },
  hanukkah: { shape: "bulb", colors: ["#5cc8ff", "#2f6fdb", "#b8c4d6"] },
  "lunar-new-year": { shape: "bulb", colors: ["#e23b2e", "#ffd54a"] },
  diwali: { shape: "bulb", colors: ["#ffb300", "#ff8a2a", "#ffd54a"] },
  "new-year": { shape: "star", colors: ["#ffd54a", "#ff9bd0", "#9be7ff"] },
  valentines: { shape: "heart", colors: ["#ff4d7d", "#ff7aa8", "#ffb3cf"] },
  easter: { shape: "egg", colors: ["#b79cff", "#7ce0c3", "#ffd54a", "#ff8fb1"] },
  "st-patricks": { shape: "bulb", colors: ["#2fb560", "#ffd54a", "#7be59d"] },
  "canada-day": { shape: "flag", colors: ["#e5322d", "#ffb3b0"] },
  "eid-al-fitr": { shape: "star", colors: ["#f5c14b", "#1a9e8f"] },
  "eid-al-adha": { shape: "star", colors: ["#f5c14b", "#1a9e8f"] },
  birthday: { shape: "flag", colors: ["#ff5c8a", "#5cc8ff", "#ffd54a", "#7ce0c3", "#c58bff"] },
};

export default function LogoLights() {
  const { theme, decorations } = useDecor();
  const lights = theme && decorations ? LIGHTS[theme.slug] : null;
  if (!lights) return null;
  return (
    <div className="reveal -mt-3 -mx-1 pointer-events-none">
      <LightString shape={lights.shape} colors={lights.colors} />
    </div>
  );
}
