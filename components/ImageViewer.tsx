// components/ImageViewer.tsx
// Full-screen picture viewer used everywhere: the pictures sit in one strip you swipe along, with pinch to zoom,
// download, upload, make default, note and delete.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { ConfirmPopup } from "@/components/Popup";
import RoundButton from "@/components/RoundButton";
import { downloadBlob } from "@/lib/ics";
import { hideAppChrome } from "@/lib/viewerChrome";

export interface ViewerImage {
  id?: string;
  url: string;
  note?: string | null;
  isDefault?: boolean;
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
  onNote?: (image: ViewerImage, note: string | null) => void;
  /** Only your own pictures can be deleted; the viewer asks first. */
  onDelete?: (image: ViewerImage) => void | Promise<void>;
  /** What happens besides the deletion, shown in the confirmation. */
  deleteMessage?: string;
}

const MAX_ZOOM = 5;
/** Dots shown at once; with more pictures than this the row slides along. */
const DOTS = 7;
const DOT_SLOT = 12;
const distance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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

export default function ImageViewer({ images, start, onClose, onAdd, onSetDefault, onNote, onDelete, deleteMessage }: Props) {
  const [index, setIndex] = useState(Math.min(start, Math.max(0, images.length - 1)));
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const pinch = useRef<{ start: number | null; base: number }>({ start: null, base: 1 });

  // The picture in view, kept inside the list when pictures are removed.
  const at = Math.min(index, Math.max(0, images.length - 1));
  const image = images[at];

  // The app's own back button and bottom bar step aside while the viewer is open.
  useEffect(() => hideAppChrome(), []);

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
      setZoom(1);
      setEditing(false);
    }
  }

  function go(by: number) {
    const el = strip.current;
    if (el) el.scrollTo({ left: Math.min(images.length - 1, Math.max(0, at + by)) * el.clientWidth, behavior: "smooth" });
  }

  async function save() {
    if (!image) return;
    try {
      const blob = await (await fetch(image.url)).blob();
      downloadBlob(`filme-${image.id ?? at + 1}.${blob.type.split("/")[1] ?? "jpg"}`, blob);
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
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <RoundButton icon="close" label="Close" onClick={onClose} className={CIRCLE} />
        {images.length > 1 ? <Dots count={images.length} index={at} /> : <span />}
        {onAdd ? <RoundButton icon="upload" label="Upload a picture" onClick={onAdd} className={CIRCLE} /> : <span className="h-10 w-10" />}
      </div>

      {/* One long strip of pictures: it follows your finger and settles on the nearest one, like the calendar's months. */}
      <div
        ref={strip}
        onScroll={onScroll}
        // While zoomed in, the strip stays put so the zoomed picture is not dragged away.
        className={`flex min-h-0 flex-1 touch-pan-x snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${zoom > 1 ? "overflow-x-hidden" : "overflow-x-auto"}`}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { start: distance(e.touches[0], e.touches[1]), base: zoom };
        }}
        onTouchMove={(e) => {
          const p = pinch.current;
          if (e.touches.length === 2 && p.start) setZoom(Math.min(MAX_ZOOM, Math.max(1, (p.base * distance(e.touches[0], e.touches[1])) / p.start)));
        }}
        onTouchEnd={(e) => {
          if (e.touches.length === 0) pinch.current = { ...pinch.current, start: null };
        }}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
      >
        {images.length === 0 && <p className="m-auto text-white/60">No pictures yet.{onAdd ? " Tap upload to add one." : ""}</p>}
        {images.map((img, i) => (
          <div key={img.id ?? img.url} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-3">
            {/* Only the pictures next to the current one are loaded, so a long list stays light. */}
            {Math.abs(i - at) <= 1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.url}
                alt={img.note ?? "Picture"}
                style={i === at ? { transform: `scale(${zoom})` } : undefined}
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-transform"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-sm">
        {image?.note && !editing && <p className="text-center text-white/80">{image.note}</p>}
        {editing && (
          <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); if (image) onNote?.(image, draft.trim() || null); setEditing(false); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Add a note" className="flex-1 rounded-full bg-white/15 px-4 py-2 text-base outline-none" />
            <RoundButton icon="check" label="Save note" onClick={() => { if (image) onNote?.(image, draft.trim() || null); setEditing(false); }} tone="dark" className="!bg-white !text-neutral-950" />
          </form>
        )}
        {image && (
          <>
            <div className="flex items-center gap-3">
              {images.length > 1 && <RoundButton icon="left" label="Previous" disabled={at === 0} onClick={() => go(-1)} size="lg" className={CIRCLE} />}
              <RoundButton icon="download" label="Download" onClick={save} size="lg" className={CIRCLE} />
              {onNote && image.id && <RoundButton icon="note" label="Note" onClick={() => { setDraft(image.note ?? ""); setEditing(true); }} size="lg" className={CIRCLE} />}
              {images.length > 1 && <RoundButton icon="right" label="Next" disabled={at === images.length - 1} onClick={() => go(1)} size="lg" className={CIRCLE} />}
            </div>

            {/* The main picture carries a star; every other one offers to become it. */}
            {onSetDefault && (image.id || image.tmdbPath) && (
              image.isDefault ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-medium">
                  <Icon name="star" size={16} filled />
                  Main
                </span>
              ) : (
                <button type="button" onClick={() => onSetDefault(image)} className="rounded-full bg-white px-5 py-2.5 font-medium text-neutral-950">
                  Make default
                </button>
              )
            )}

            {onDelete && image.id && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 font-medium text-red-300">
                <Icon name="trash" size={16} />
                Delete photo
              </button>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmPopup
          title="Delete this photo?"
          message={deleteMessage ?? "It is removed for good."}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
