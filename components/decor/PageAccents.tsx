// components/decor/PageAccents.tsx
// Now and then, a small festival charm perches on something already on the page: the end of a heading, the corner of
// a text field, or the corner of a card. They are picked fresh on each visit, so it feels found, never fixed; some
// visits have nothing at all. Each charm lives inside the thing it sits on, so it scrolls with it and never covers text.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ThemeIcon from "@/components/ThemeIcon";
import { Accent } from "./art";
import { CHARMS } from "./charms";
import { Falls, Piece } from "./Touchy";
import { useDecor } from "./useDecor";

/** Pages that carry their own picture or have nothing to perch on. */
const HIDE = ["/", "/login/", "/story/", "/map/"];
/** Pages that open on a cover photo: their big title sits over it, so only the smaller headings are used. */
const OVER_COVER = ["/title/", "/preview/", "/season/", "/episode/"];

type Kind = "heading" | "field" | "card";
interface Spot {
  id: number;
  kind: Kind;
  host: HTMLElement;
  /** Where inside the host a field or card charm sits, in pixels. */
  x: number;
  y: number;
  name: string;
  size: number;
}

const FIELD_SELECTOR = 'main input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), main textarea, main select';
const CARD_SELECTOR = 'main ul > li[class*="rounded"], main section[class*="rounded"]';

const shuffle = <T,>(list: T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const visible = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  return box.width > 24 && box.height > 8 && !el.closest('nav, [role="dialog"], [aria-hidden="true"]');
};

/** Page elements that were made positioning anchors for a charm, so they can be put back when the charms leave. */
const anchored = new Set<HTMLElement>();
function anchor(host: HTMLElement) {
  if (getComputedStyle(host).position !== "static") return;
  host.style.position = "relative";
  anchored.add(host);
}
function releaseAnchors() {
  anchored.forEach((host) => {
    host.style.position = "";
  });
  anchored.clear();
}

/** Chooses up to three things on the page to hang charms on. */
function chooseSpots(slug: string, path: string): Spot[] {
  const names = CHARMS[slug];
  if (!names) return [];
  const pickName = () => names[Math.floor(Math.random() * names.length)];
  const headings = [...document.querySelectorAll<HTMLElement>(OVER_COVER.includes(path) ? "main h2" : "main h1, main h2")].filter(visible);
  const fields = [...document.querySelectorAll<HTMLElement>(FIELD_SELECTOR)].filter(visible);
  const cards = [...document.querySelectorAll<HTMLElement>(CARD_SELECTOR)].filter(visible);
  let id = 0;

  const spots: Spot[] = [
    ...shuffle(headings).slice(0, 2).map((el): Spot => ({ id: id++, kind: "heading", host: el, x: 0, y: 0, name: pickName(), size: el.tagName === "H1" ? 34 : 26 })),
    ...shuffle(fields).slice(0, 1).map((el): Spot => {
      const host = (el.parentElement ?? el) as HTMLElement;
      const box = el.getBoundingClientRect();
      const around = host.getBoundingClientRect();
      return { id: id++, kind: "field", host, x: box.right - around.left - 34, y: box.top - around.top - 20, name: pickName(), size: 30 };
    }),
    ...shuffle(cards).slice(0, 1).map((el): Spot => ({ id: id++, kind: "card", host: el, x: el.getBoundingClientRect().width - 52, y: -16, name: pickName(), size: 34 })),
  ];
  const chosen = shuffle(spots).slice(0, 1 + Math.floor(Math.random() * 3));
  chosen.filter((spot) => spot.kind !== "heading").forEach((spot) => anchor(spot.host));
  return chosen;
}

function Charm({ spot, slug }: { spot: Spot; slug: string }) {
  const body = spot.name === "icon" ? <ThemeIcon slug={slug} size={spot.size} /> : <Accent name={spot.name} size={spot.size} />;
  // A string of firecrackers pops instead of falling.
  const inner = spot.name === "firecrackers"
    ? <Piece colors={["#ffd54a", "#e5322d", "#ff8a2a", "#fff3b0"]} back={600000} slop={14} className="relative inline-block">{body}</Piece>
    : <Falls slop={14}>{body}</Falls>;

  if (spot.kind === "heading") return <span aria-hidden className="pointer-events-none ml-2 inline-block align-middle">{inner}</span>;
  return <span aria-hidden className="pointer-events-none absolute z-[1]" style={{ left: spot.x, top: spot.y }}>{inner}</span>;
}

/** Puts a charm inside its host. */
function PerchedCharm({ spot, slug }: { spot: Spot; slug: string }) {
  return createPortal(<Charm spot={spot} slug={slug} />, spot.host);
}

export default function PageAccents() {
  const path = usePathname() ?? "/";
  const { theme, decorations } = useDecor();
  const [spots, setSpots] = useState<Spot[]>([]);
  const slug = theme?.slug ?? null;

  useEffect(() => {
    if (!slug || !decorations || HIDE.includes(path)) {
      const clear = setTimeout(() => setSpots([]), 0);
      return () => {
        clearTimeout(clear);
        releaseAnchors();
      };
    }
    // Some visits get nothing at all; the page is also given a moment to fill in before things are chosen.
    const nothing = Math.random() < 0.2;
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setSpots([]), 0)];
    if (!nothing) {
      const scan = () => setSpots((now) => (now.length > 0 ? now : chooseSpots(slug, path)));
      timers.push(setTimeout(scan, 900), setTimeout(scan, 2600));
    }
    return () => {
      timers.forEach(clearTimeout);
      releaseAnchors();
    };
  }, [path, slug, decorations]);

  if (!slug || !decorations || HIDE.includes(path)) return null;
  return <>{spots.map((spot) => <PerchedCharm key={spot.id} spot={spot} slug={slug} />)}</>;
}
