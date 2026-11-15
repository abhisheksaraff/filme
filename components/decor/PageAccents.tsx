// components/decor/PageAccents.tsx
// Now and then, a small piece of the theme appears on a page: a charm by the top corner or a strip above the bottom bar.
// It is picked fresh on each visit, so it feels found, never fixed; some visits have nothing at all.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeIcon from "@/components/ThemeIcon";
import { Accent, Garland } from "./art";
import { Falls, Flickers } from "./Touchy";
import { useDecor } from "./useDecor";

/** Pages that already have their own picture or crowd the top corner. */
const HIDE = ["/", "/login/", "/story/", "/map/", "/home/", "/title/", "/preview/", "/season/", "/episode/"];

type Strip = "garland" | "diyas" | "icons";
interface Art {
  /** Names from the accent library, or `icon` for the theme's own picture. */
  corner: string[];
  strip: Strip;
}

const ART: Record<string, Art> = {
  christmas: { corner: ["snowman", "snowglobe", "wreath", "icon"], strip: "garland" },
  valentines: { corner: ["cupid", "icon"], strip: "icons" },
  easter: { corner: ["egg", "icon"], strip: "icons" },
  halloween: { corner: ["litPumpkin", "icon"], strip: "icons" },
  birthday: { corner: ["cake", "beach", "rocket", "satellite", "planet", "icon"], strip: "icons" },
  diwali: { corner: ["diya", "icon"], strip: "diyas" },
  "new-year": { corner: ["icon"], strip: "icons" },
  "lunar-new-year": { corner: ["icon"], strip: "icons" },
  "st-patricks": { corner: ["icon"], strip: "icons" },
  "canada-day": { corner: ["icon"], strip: "icons" },
  "eid-al-fitr": { corner: ["icon"], strip: "icons" },
  "eid-al-adha": { corner: ["icon"], strip: "icons" },
  hanukkah: { corner: ["icon"], strip: "icons" },
};

type Pick = { kind: "corner"; name: string } | { kind: "strip" } | null;

const roll = (art: Art): Pick => {
  const r = Math.random();
  if (r < 0.3) return null;
  if (r < 0.65) return { kind: "corner", name: art.corner[Math.floor(Math.random() * art.corner.length)] };
  return { kind: "strip" };
};

export default function PageAccents() {
  const path = usePathname() ?? "/";
  const { theme, decorations } = useDecor();
  const [pick, setPick] = useState<Pick>(null);
  // Counts visits, so pieces that fell off the screen on one page are back on the next.
  const [visit, setVisit] = useState(0);
  const slug = theme?.slug ?? null;

  useEffect(() => {
    const art = slug ? ART[slug] : null;
    const timer = setTimeout(() => {
      setPick(art ? roll(art) : null);
      setVisit((n) => n + 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [path, slug]);

  const art = slug ? ART[slug] : null;
  if (!decorations || !slug || !art || !pick || HIDE.includes(path)) return null;

  if (pick.kind === "corner") {
    return (
      <div
        key={visit}
        aria-hidden
        className="reveal pointer-events-none fixed right-4 z-10"
        style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 0.15rem)" }}
      >
        <Falls slop={18}>{pick.name === "icon" ? <ThemeIcon slug={slug} size={40} /> : <Accent name={pick.name} size={44} />}</Falls>
      </div>
    );
  }

  return (
    <div
      key={visit}
      aria-hidden
      className="reveal pointer-events-none fixed inset-x-0 z-10 mx-auto w-full max-w-md px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.1rem)" }}
    >
      {art.strip === "garland" && <Flickers>{(on) => <Garland flicker={on} />}</Flickers>}
      {art.strip === "diyas" && (
        <div className="flex justify-around">
          {[0, 1, 2, 3, 4].map((i) => <Falls key={i}><Accent name="diya" size={34} /></Falls>)}
        </div>
      )}
      {art.strip === "icons" && (
        <div className="flex justify-around">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Falls key={i} style={{ marginTop: i % 2 ? 6 : 0 }} slop={10}><ThemeIcon slug={slug} size={28} /></Falls>)}
        </div>
      )}
    </div>
  );
}
