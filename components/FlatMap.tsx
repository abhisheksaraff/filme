// components/FlatMap.tsx
// A flat map made of CARTO tiles with the app's own pins on top. Inline, one finger scrolls the page
// and two fingers move and pinch-zoom the map; full screen, one finger drags the map too. A mouse can
// drag, and ctrl + wheel zooms.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import RoundButton from "@/components/RoundButton";
import type { VenuePoint } from "@/lib/ports/browse";

const TILE = 256;
/** CARTO's raster tiles show a watermark without a (free) key; get one at carto.com/basemaps/apikey and set NEXT_PUBLIC_CARTO_KEY. */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY ?? "";
const MIN_ZOOM = 1.5;
const MAX_ZOOM = 18;
/** Pins closer than this many pixels merge into one numbered circle. */
const CLUSTER_PX = 44;

export const KIND_ICON: Record<string, IconName> = { Movie: "film", "TV Show": "tv", Concert: "mic", "Live Event": "masks", home: "home" };

interface View {
  lon: number;
  lat: number;
  zoom: number;
}

// Web Mercator, as a fraction of the whole world (0 to 1) so any zoom can scale it.
const mx = (lon: number) => (lon + 180) / 360;
const my = (lat: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
const lonOf = (x: number) => x * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface Pin {
  key: string;
  x: number;
  y: number;
  icon: IconName;
  count: number;
  /** Set for a single venue's pin; a merged pin has none. */
  point?: VenuePoint;
  category?: string;
  /** For a merged pin: where to zoom to. */
  members?: VenuePoint[];
}

interface Props {
  points: VenuePoint[];
  onPick?: (point: VenuePoint, category: string | null) => void;
  className?: string;
  /** Fills the screen behind the page chrome: one finger drags the map, and controls sit below the top bar. */
  fullScreen?: boolean;
  /** Start centred here instead of framing every pin. */
  focus?: { lon: number; lat: number; zoom: number };
  /** A small picture of the map: no controls, no gestures; the page puts a link over it. */
  still?: boolean;
  /** The icon on the pin of a still map. */
  pinIcon?: IconName;
}

export default function FlatMap({ points, onPick, className = "h-[60vh]", fullScreen = false, focus, still = false, pinIcon }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [custom, setCustom] = useState<View | null>(null);
  const [dark, setDark] = useState(false);
  const [retina, setRetina] = useState(false);
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef(size);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    setDark(document.documentElement.classList.contains("dark"));
    setRetina(window.devicePixelRatio >= 1.5);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Until the user moves the map, it is framed around all pins.
  const fitted = useMemo<View>(() => {
    if (focus) return focus;
    if (points.length === 0 || !size) return { lon: -79.4, lat: 43.7, zoom: 3 };
    const xs = points.map((p) => mx(p.longitude));
    const ys = points.map((p) => my(p.latitude));
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const zoomFor = (span: number, px: number) => (span > 0 ? Math.log2((px * 0.7) / (TILE * span)) : 13);
    return {
      lon: lonOf((Math.max(...xs) + Math.min(...xs)) / 2),
      lat: latOf((Math.max(...ys) + Math.min(...ys)) / 2),
      zoom: clampZoom(Math.min(zoomFor(spanX, size.w), zoomFor(spanY, size.h), 13)),
    };
  }, [points, size, focus]);

  const view = custom ?? fitted;
  useEffect(() => {
    viewRef.current = view;
    sizeRef.current = size;
  });

  // Two-finger gestures are handled here as native listeners so they can stop the page from scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let last: { x: number; y: number; d: number } | null = null;
    const read = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1] ?? e.touches[0]];
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    };
    // Full screen has no page to scroll, so a single finger moves the map as well.
    const need = fullScreen ? 1 : 2;
    const start = (e: TouchEvent) => {
      last = e.touches.length >= need ? read(e) : null;
    };
    const move = (e: TouchEvent) => {
      const v = viewRef.current;
      const s = sizeRef.current;
      if (e.touches.length < need || !last || !v || !s) return;
      e.preventDefault();
      const now = read(e);
      const rect = el.getBoundingClientRect();
      const ratio = e.touches.length >= 2 ? now.d / (last.d || 1) : 1;
      setCustom(transform(v, s, { x: last.x - rect.left, y: last.y - rect.top }, { x: now.x - rect.left, y: now.y - rect.top }, ratio));
      last = now;
    };
    const end = (e: TouchEvent) => {
      last = e.touches.length >= need ? read(e) : null;
    };
    const wheel = (e: WheelEvent) => {
      const v = viewRef.current;
      const s = sizeRef.current;
      // Plain scrolling stays with the page; only a pinch on a trackpad (ctrl + wheel) zooms.
      if (!e.ctrlKey || !v || !s) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCustom(transform(v, s, at, at, Math.exp(-e.deltaY * 0.01)));
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("wheel", wheel);
    };
  }, [fullScreen]);

  const drag = useRef<{ x: number; y: number } | null>(null);

  function zoomBy(delta: number, around?: { lon: number; lat: number }) {
    if (!size) return;
    const target = around ? { ...view, ...around } : view;
    setCustom({ ...target, zoom: clampZoom(view.zoom + delta) });
  }

  const pins = useMemo<Pin[]>(() => {
    if (!size) return [];
    const scale = TILE * 2 ** view.zoom;
    const cx = mx(view.lon) * scale;
    const cy = my(view.lat) * scale;
    const placed = points.map((point) => ({
      point,
      x: mx(point.longitude) * scale - cx + size.w / 2,
      y: my(point.latitude) * scale - cy + size.h / 2,
    }));

    // Venues that sit too close together are merged into one numbered pin.
    const groups: { x: number; y: number; items: typeof placed }[] = [];
    for (const item of placed) {
      if (item.x < -60 || item.y < -60 || item.x > size.w + 60 || item.y > size.h + 60) continue;
      const near = groups.find((g) => Math.hypot(g.x - item.x, g.y - item.y) < CLUSTER_PX);
      if (near) near.items.push(item);
      else groups.push({ x: item.x, y: item.y, items: [item] });
    }

    return groups.flatMap((g): Pin[] => {
      if (g.items.length > 1) {
        return [{ key: `c-${g.items[0].point.id}`, x: g.x, y: g.y, icon: "layers", count: g.items.reduce((n, i) => n + i.point.count, 0), members: g.items.map((i) => i.point) }];
      }
      const { point } = g.items[0];
      if (still) return [{ key: point.id, x: g.x, y: g.y, icon: pinIcon ?? "film", count: point.count, point }];
      // A home is one pin; any other venue gets a pin per kind of thing watched there.
      const kinds = point.type === "home" ? [{ category: "home", count: point.count }] : point.kinds;
      return kinds.map((kind, i) => ({
        key: `${point.id}-${kind.category}`,
        x: g.x + (i - (kinds.length - 1) / 2) * 42,
        y: g.y,
        icon: KIND_ICON[kind.category] ?? "film",
        count: kind.count,
        point,
        category: kind.category === "home" ? undefined : kind.category,
      }));
    });
  }, [points, size, view, still, pinIcon]);

  const tiles = useMemo(() => {
    if (!size || !CARTO_KEY) return [];
    const zi = Math.min(19, Math.max(0, Math.floor(view.zoom)));
    const tile = TILE * 2 ** (view.zoom - zi);
    const world = TILE * 2 ** view.zoom;
    const left = mx(view.lon) * world - size.w / 2;
    const top = my(view.lat) * world - size.h / 2;
    const n = 2 ** zi;
    const out: { key: string; src: string; x: number; y: number; size: number }[] = [];
    for (let ty = Math.floor(top / tile); ty <= Math.floor((top + size.h) / tile); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(left / tile); tx <= Math.floor((left + size.w) / tile); tx++) {
        const wrapped = ((tx % n) + n) % n;
        out.push({
          key: `${zi}/${tx}/${ty}`,
          src: `https://basemaps.cartocdn.com/rastertiles/${dark ? "dark_all" : "light_all"}/${zi}/${wrapped}/${ty}${retina ? "@2x" : ""}.png?key=${CARTO_KEY}`,
          x: tx * tile - left,
          y: ty * tile - top,
          size: tile,
        });
      }
    }
    return out;
  }, [size, view, dark, retina]);

  return (
    <div
      ref={box}
      className={`relative w-full select-none overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${fullScreen ? "" : "rounded-3xl"} ${className}`}
      // Inline, one finger keeps scrolling the page and two fingers are taken over above.
      style={{ touchAction: fullScreen ? "none" : "pan-y" }}
      aria-hidden={still || undefined}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !drag.current || !size) return;
        const from = { x: drag.current.x, y: drag.current.y };
        drag.current = { x: e.clientX, y: e.clientY };
        setCustom(transform(view, size, from, { x: e.clientX, y: e.clientY }, 1));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={t.key} src={t.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: t.x, top: t.y, width: t.size + 0.5, height: t.size + 0.5 }} />
      ))}

      {!CARTO_KEY && (
        <p className="absolute inset-x-6 top-4 rounded-2xl bg-white/90 px-3 py-2 text-center text-xs text-neutral-700 dark:bg-black/70 dark:text-neutral-200">
          Map key missing: set NEXT_PUBLIC_CARTO_KEY to show the map background.
        </p>
      )}

      {pins.map((pin) => (
        <button
          tabIndex={still ? -1 : undefined}
          key={pin.key}
          type="button"
          aria-label={pin.point ? `${pin.point.name}, ${pin.count}` : `${pin.count} venues`}
          onClick={() => {
            if (pin.point) onPick?.(pin.point, pin.category ?? null);
            else if (pin.members) {
              const lon = pin.members.reduce((n, m) => n + m.longitude, 0) / pin.members.length;
              const lat = pin.members.reduce((n, m) => n + m.latitude, 0) / pin.members.length;
              zoomBy(2, { lon, lat });
            }
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pin.x, top: pin.y }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg ring-2 ring-white">
            {pin.point ? <Icon name={pin.icon} size={18} /> : <span className="text-sm font-medium">{pin.count}</span>}
          </span>
          {pin.point && !still && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-neutral-950 shadow">
              {pin.count}
            </span>
          )}
        </button>
      ))}

      {!still && <div className={`absolute right-3 flex flex-col gap-2 ${fullScreen ? "top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)]" : "top-3"}`}>
        <RoundButton icon="plus" label="Zoom in" onClick={() => zoomBy(1)} />
        <RoundButton icon="minus" label="Zoom out" onClick={() => zoomBy(-1)} />
      </div>}
      <span className={`pointer-events-none absolute left-2 rounded bg-white/70 ${fullScreen ? "bottom-24" : "bottom-1"} px-1 text-[10px] text-neutral-700 dark:bg-black/50 dark:text-neutral-300`}>
        © OpenStreetMap © CARTO
      </span>
    </div>
  );
}

/** Moves the map so the point under `from` ends up under `to`, zooming by `ratio` around it. */
function transform(view: View, size: { w: number; h: number }, from: { x: number; y: number }, to: { x: number; y: number }, ratio: number): View {
  const oldScale = TILE * 2 ** view.zoom;
  const zoom = clampZoom(view.zoom + Math.log2(ratio));
  const newScale = TILE * 2 ** zoom;
  // The world point that was under the first position, as a fraction of the world.
  const fx = (mx(view.lon) * oldScale + from.x - size.w / 2) / oldScale;
  const fy = (my(view.lat) * oldScale + from.y - size.h / 2) / oldScale;
  const x = (fx * newScale - (to.x - size.w / 2)) / newScale;
  const y = (fy * newScale - (to.y - size.h / 2)) / newScale;
  return { lon: lonOf(Math.min(1, Math.max(0, x))), lat: latOf(Math.min(0.999, Math.max(0.001, y))), zoom };
}
