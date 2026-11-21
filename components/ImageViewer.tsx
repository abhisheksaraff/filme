// components/ImageViewer.tsx
// Full-screen picture viewer used everywhere: the pictures sit in one strip you swipe along, with pinch to zoom,
// download, upload, make default and delete.
"use client";

import Portal from "@/components/Portal";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { ConfirmPopup } from "@/components/Popup";
import RoundButton from "@/components/RoundButton";
import { downloadBlob } from "@/lib/ics";
import { absorbStrayTap } from "@/lib/viewerChrome";

export interface ViewerImage {
  id?: string;
  url: string;
  note?: string | null;
  isDefault?: boolean;
  /** Not saved anywhere yet (a ticket or photo on a page still being filled in); it can still be removed. */
  local?: boolean;
  /** A TMDB picture that is not saved anywhere; choosing it makes the title point at it. */
  tmdbPath?: string;
}

interface Props {
  images: ViewerImage[];
  start: number;
  onClose: () => void;
  /** Shows an upload button; the page decides how the new picture is chosen and saved. */
  onAdd?: () => void;
  onSetDefault?: (image: ViewerImage) => void | Promise<void>;
  /** Only your own pictures can be deleted; the viewer asks first. */
  onDelete?: (image: ViewerImage) => void | Promise<void>;
  /** What happens besides the deletion, shown in the confirmation. */
  deleteMessage?: string;
}

const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

/** How the picture is shown: a scale, and how far it has been moved from the middle in px. */
interface View { s: number; x: number; y: number }
const REST: View = { s: 1, x: 0, y: 0 };
/** Keeps a zoomed picture's edges from being dragged past the edges of its box. */
function clampView(v: View, w: number, h: number): View {
  const mx = ((v.s - 1) * w) / 2;
  const my = ((v.s - 1) * h) / 2;
  return { s: v.s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}
const css = (v: View) => `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
const mid = (a: React.Touch, b: React.Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

/** One touch gesture on the zoomed picture; lives in a ref so moving the picture never re-draws the viewer. */
interface Gesture {
  mode: "none" | "pinch" | "pan";
  /** Centre and size of the picture's box, which the picture scales about. */
  cx: number; cy: number; w: number; h: number;
  startDist: number;
  /** The view when the gesture began, the point of the picture under the fingers then, and the view as drawn now. */
  base: View; ux: number; uy: number; live: View;
  startX: number; startY: number;
  moved: number;
  lastTap: { t: number; x: number; y: number } | null;
  lastTouchAt: number;
}
/** Dots shown at once; with more pictures than this the row slides along. */
const DOTS = 7;
const DOT_SLOT = 12;
const onTouchApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const distance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
/** A picture with the main-picture star drawn over its own top right corner, whatever its shape and however it is scaled to fit. */
function ViewerPicture({ url, alt, main }: { url: string; alt: string; main: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const [corner, setCorner] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = img.current;
    if (!el || !main) return;
    // The picture's box is its shown size, so its offset inside the centred wrapper places the star on the picture itself.
    const place = () => setCorner({ left: el.offsetLeft + el.offsetWidth, top: el.offsetTop });
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [main, url]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={url} alt={alt} onLoad={() => img.current && main && setCorner({ left: img.current.offsetLeft + img.current.offsetWidth, top: img.current.offsetTop })} className="max-h-full max-w-full object-contain" />
      {main && corner && (
        <span role="img" aria-label="Main picture" style={{ left: corner.left - 40, top: corner.top + 8 }}
          className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-black text-white shadow-lg ring-1 ring-white/30">
          <Icon name="star" size={16} filled />
        </span>
      )}
    </>
  );
}

const CIRCLE = "bg-white/15 text-white dark:bg-white/15 dark:text-white";

/** Position dots: only a few at a time, sliding along with the current picture. Not touchable. */
function Dots({ count, index }: { count: number; index: number }) {
  const first = Math.min(Math.max(0, index - Math.floor(DOTS / 2)), Math.max(0, count - DOTS));
  return (
    <div
      aria-label={`Picture ${index + 1} of ${count}`}
      className="pointer-events-none overflow-hidden"
      style={{ width: Math.min(count, DOTS) * DOT_SLOT }}
    >
      <div className="flex transition-transform duration-300" style={{ transform: `translateX(${-first * DOT_SLOT}px)` }}>
        {Array.from({ length: count }, (_, i) => {
          const d = Math.abs(i - index);
          // The current dot is long, its neighbours medium, the far ones small, so the row fades out at both ends.
          const size = d === 0 ? "w-3.5 bg-white" : d <= 2 ? "w-1.5 bg-white/50" : "w-1 bg-white/30";
          return (
            <span key={i} className="flex shrink-0 items-center justify-center" style={{ width: DOT_SLOT }}>
              <span className={`h-1.5 rounded-full transition-all duration-300 ${size}`} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ImageViewerInner({ images, start, onClose, onAdd, onSetDefault, onDelete, deleteMessage }: Props) {
  const [index, setIndex] = useState(Math.min(start, Math.max(0, images.length - 1)));
  const [view, setView] = useState<View>(REST);
  const zoom = view.s;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  // While fingers are down the picture is moved directly (no re-drawing, no easing) from a smoothed value; the view is committed when they lift.
  const gesture = useRef<Gesture>({ mode: "none", cx: 0, cy: 0, w: 1, h: 1, startDist: 1, base: REST, ux: 0, uy: 0, live: REST, startX: 0, startY: 0, moved: 0, lastTap: null, lastTouchAt: 0 });
  const zoomEl = useRef<HTMLDivElement | null>(null);

  // The picture in view, kept inside the list when pictures are removed.
  const at = Math.min(index, Math.max(0, images.length - 1));
  const image = images[at];

  // A late tap on close lands on a clear sheet instead of the button underneath.
  useEffect(() => absorbStrayTap(), []);
  // Keyboard: left and right move between pictures, Escape closes. Typing in the note field is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Puts the strip on the current picture when it opens and whenever pictures are added or removed.
  useLayoutEffect(() => {
    const el = strip.current;
    if (el) el.scrollTo({ left: at * el.clientWidth, behavior: "instant" });
    // `at` only matters at those moments; swiping moves the strip itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  function onScroll() {
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) {
      setIndex(next);
      setView(REST);
    }
  }

  /** Zooms in on the spot that was tapped, or back out when already zoomed. */
  function toggleZoomAt(clientX: number, clientY: number) {
    const box = zoomEl.current?.parentElement;
    if (!box) return;
    if (view.s > 1) return setView(REST);
    const r = box.getBoundingClientRect();
    const px = clientX - (r.left + r.width / 2);
    const py = clientY - (r.top + r.height / 2);
    setView(clampView({ s: DOUBLE_TAP_ZOOM, x: -px * (DOUBLE_TAP_ZOOM - 1), y: -py * (DOUBLE_TAP_ZOOM - 1) }, r.width, r.height));
  }

  function go(by: number) {
    const el = strip.current;
    if (el) el.scrollTo({ left: Math.min(images.length - 1, Math.max(0, at + by)) * el.clientWidth, behavior: "smooth" });
  }

  /** iPhone and iPad: the share sheet, which offers Save Image (Photos) and Save to Files. Elsewhere the file downloads. */
  async function save() {
    if (!image) return;
    try {
      const blob = await (await fetch(image.url)).blob();
      const name = `filme-${image.id ?? at + 1}.${blob.type.split("/")[1] ?? "jpg"}`;
      const file = new File([blob], name, { type: blob.type });
      if (onTouchApple() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          // Closing the share sheet is not an error.
        }
        return;
      }
      downloadBlob(name, blob);
    } catch {
      window.open(image.url, "_blank");
    }
  }

  async function remove() {
    if (!image || !onDelete) return;
    setBusy(true);
    await onDelete(image);
    setBusy(false);
    setConfirmDelete(false);
    if (images.length === 1) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <RoundButton icon="close" label="Close" onClick={onClose} className={`justify-self-start ${CIRCLE}`} />
        {images.length > 1 ? <Dots count={images.length} index={at} /> : <span />}
        <div className="flex justify-end gap-2">
          {image && <RoundButton icon="download" label="Save or share" onClick={save} className={CIRCLE} />}
          {onAdd && <RoundButton icon="plus" label="Upload a picture" onClick={onAdd} className={CIRCLE} />}
        </div>
      </div>

      {/* One long strip of pictures: it follows your finger and settles on the nearest one, like the calendar's months. */}
      <div
        ref={strip}
        onScroll={onScroll}
        // While zoomed in, the strip stays put so the zoomed picture is not dragged away.
        className={`flex min-h-0 flex-1 snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${zoom > 1 ? "touch-none overflow-x-hidden" : "touch-pan-x overflow-x-auto"}`}
        onTouchStart={(e) => {
          const g = gesture.current;
          const box = zoomEl.current?.parentElement;
          if (!box || !zoomEl.current) return;
          const r = box.getBoundingClientRect();
          g.cx = r.left + r.width / 2; g.cy = r.top + r.height / 2; g.w = r.width; g.h = r.height;
          g.base = view; g.live = view; g.moved = 0;
          if (e.touches.length === 2) {
            // The point of the picture between the fingers is the one that has to stay between them.
            const m = mid(e.touches[0], e.touches[1]);
            g.mode = "pinch";
            g.startDist = distance(e.touches[0], e.touches[1]);
            g.ux = (m.x - g.cx - view.x) / view.s;
            g.uy = (m.y - g.cy - view.y) / view.s;
            zoomEl.current.style.transition = "none";
          } else if (e.touches.length === 1) {
            g.startX = e.touches[0].clientX; g.startY = e.touches[0].clientY;
            if (view.s > 1) {
              g.mode = "pan";
              zoomEl.current.style.transition = "none";
            } else g.mode = "none";
          }
        }}
        onTouchMove={(e) => {
          const g = gesture.current;
          const el = zoomEl.current;
          if (!el) return;
          if (g.mode === "pinch" && e.touches.length === 2) {
            const m = mid(e.touches[0], e.touches[1]);
            const target = Math.min(MAX_ZOOM, Math.max(1, (g.base.s * distance(e.touches[0], e.touches[1])) / g.startDist));
            // Fingers drift a little even when held still; scale changes under 1% are ignored and the rest is followed part of the way.
            const s = Math.abs(target - g.live.s) / g.live.s < 0.01 ? g.live.s : g.live.s + (target - g.live.s) * 0.4;
            g.live = clampView({ s, x: m.x - g.cx - g.ux * s, y: m.y - g.cy - g.uy * s }, g.w, g.h);
            el.style.transform = css(g.live);
          } else if (g.mode === "pan" && e.touches.length === 1) {
            const dx = e.touches[0].clientX - g.startX;
            const dy = e.touches[0].clientY - g.startY;
            g.moved = Math.max(g.moved, Math.hypot(dx, dy));
            g.live = clampView({ s: g.base.s, x: g.base.x + dx, y: g.base.y + dy }, g.w, g.h);
            el.style.transform = css(g.live);
          } else if (e.touches.length === 1) {
            g.moved = Math.max(g.moved, Math.hypot(e.touches[0].clientX - g.startX, e.touches[0].clientY - g.startY));
          }
        }}
        onTouchEnd={(e) => {
          const g = gesture.current;
          const el = zoomEl.current;
          g.lastTouchAt = Date.now();
          if (g.mode === "pinch" && e.touches.length < 2) {
            // Nearly back at normal size settles at exactly normal size.
            const next = g.live.s < 1.08 ? REST : clampView({ ...g.live, s: g.live.s }, g.w, g.h);
            g.mode = "none";
            if (el) { el.style.transition = ""; el.style.transform = css(next); }
            setView(next);
            return;
          }
          if (g.mode === "pan" && e.touches.length === 0 && g.moved > 8) {
            g.mode = "none";
            if (el) { el.style.transition = ""; el.style.transform = css(g.live); }
            setView(g.live);
            return;
          }
          if (e.touches.length > 0) return;
          g.mode = "none";
          if (el) el.style.transition = "";
          // A quick second tap near the first zooms in on that spot, or back out.
          const t = e.changedTouches[0];
          if (!t || g.moved > 8) { g.lastTap = null; return; }
          const last = g.lastTap;
          if (last && Date.now() - last.t < 300 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
            g.lastTap = null;
            toggleZoomAt(t.clientX, t.clientY);
          } else g.lastTap = { t: Date.now(), x: t.clientX, y: t.clientY };
        }}
        onDoubleClick={(e) => {
          // A touch double-tap is handled above; this is the mouse.
          if (Date.now() - gesture.current.lastTouchAt < 700) return;
          toggleZoomAt(e.clientX, e.clientY);
        }}
      >
        {images.length === 0 && <p className="m-auto text-white/60">No pictures yet.{onAdd ? " Tap upload to add one." : ""}</p>}
        {images.map((img, i) => (
          <div key={img.id ?? img.url} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-3">
            {/* Only the pictures next to the current one are loaded, so a long list stays light. */}
            {Math.abs(i - at) <= 1 && (
              // The box fills the space it is given, so the picture is measured against something definite and shows at full size.
              <div ref={i === at ? zoomEl : undefined} className="relative flex h-full w-full items-center justify-center transition-transform" style={i === at ? { transform: css(view) } : undefined}>
                <ViewerPicture url={img.url} alt={img.note ?? "Picture"} main={Boolean(img.isDefault && onSetDefault)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-sm">
        {image && (
          <>
            {/* Arrows sit right under the picture, away from the buttons that change things. */}
            <div className="flex items-center gap-10">
              {images.length > 1 && <RoundButton icon="left" label="Previous" disabled={at === 0} onClick={() => go(-1)} size="lg" className={CIRCLE} />}
              {/* The middle slot stays empty so the arrows keep the same distance they had. */}
              {images.length > 1 && <span aria-hidden className="h-12 w-12" />}
              {images.length > 1 && <RoundButton icon="right" label="Next" disabled={at === images.length - 1} onClick={() => go(1)} size="lg" className={CIRCLE} />}
            </div>

            {/* Choices that change what is kept sit lower, with room above them so they are not hit by accident. */}
            {((onSetDefault && (image.id || image.tmdbPath) && !image.isDefault) || (onDelete && (image.id || image.local))) && (
              <div className="mt-6 flex items-center gap-3">
                {onSetDefault && (image.id || image.tmdbPath) && !image.isDefault && (
                  <button type="button" onClick={() => onSetDefault(image)} className="rounded-full bg-white px-5 py-2.5 font-medium text-neutral-950">
                    Make default
                  </button>
                )}
                {onDelete && (image.id || image.local) && (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-medium text-red-300">
                    <Icon name="trash" size={16} />
                    Delete photo
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmPopup
          title="Delete this photo?"
          message={deleteMessage ?? "It is removed for good."}
          confirmLabel="Delete" confirmIcon="trash"
         
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/** Drawn above the whole app, so the back button and bottom bar sit dimmed behind it. */
export default function ImageViewer(props: Props) {
  return (
    <Portal>
      <ImageViewerInner {...props} />
    </Portal>
  );
}
