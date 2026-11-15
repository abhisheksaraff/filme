// components/ImageViewer.tsx
// Full-screen picture viewer used everywhere: swipe, pinch to zoom, download, add, set default, note.
"use client";

import { useRef, useState } from "react";
import RoundButton from "@/components/RoundButton";
import { downloadBlob } from "@/lib/ics";

export interface ViewerImage {
  id?: string;
  url: string;
  note?: string | null;
  isDefault?: boolean;
  /** A TMDB picture that is not saved yet; it is saved when it is set as the main one. */
  tmdbPath?: string;
}

interface Props {
  images: ViewerImage[];
  start: number;
  onClose: () => void;
  /** Shows a + button; the page decides how a new picture is chosen. */
  onAdd?: () => void;
  onSetDefault?: (image: ViewerImage) => void;
  onNote?: (image: ViewerImage, note: string | null) => void;
  onDelete?: (image: ViewerImage) => void;
}

const MAX_ZOOM = 5;
const distance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export default function ImageViewer({ images, start, onClose, onAdd, onSetDefault, onNote, onDelete }: Props) {
  const [index, setIndex] = useState(Math.min(start, Math.max(0, images.length - 1)));
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const touch = useRef<{ x: number; pinch: number | null; base: number }>({ x: 0, pinch: null, base: 1 });

  const image = images[index];

  function go(by: number) {
    setZoom(1);
    setEditing(false);
    setIndex((i) => Math.min(images.length - 1, Math.max(0, i + by)));
  }

  async function save() {
    if (!image) return;
    try {
      const blob = await (await fetch(image.url)).blob();
      downloadBlob(`filme-${image.id ?? index + 1}.${blob.type.split("/")[1] ?? "jpg"}`, blob);
    } catch {
      window.open(image.url, "_blank");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <RoundButton icon="close" label="Close" onClick={onClose} className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />
        {images.length > 1 && (
          <div className="flex gap-1.5" aria-label={`Picture ${index + 1} of ${images.length}`}>
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />)}
          </div>
        )}
        {onAdd ? <RoundButton icon="plus" label="Add a picture" onClick={onAdd} className="bg-white/15 text-white dark:bg-white/15 dark:text-white" /> : <span className="h-10 w-10" />}
      </div>

      <div
        className="flex flex-1 touch-none items-center justify-center overflow-hidden px-3"
        onTouchStart={(e) => {
          if (e.touches.length === 2) touch.current = { ...touch.current, pinch: distance(e.touches[0], e.touches[1]), base: zoom };
          else touch.current = { x: e.touches[0].clientX, pinch: null, base: zoom };
        }}
        onTouchMove={(e) => {
          const t = touch.current;
          if (e.touches.length === 2 && t.pinch) setZoom(Math.min(MAX_ZOOM, Math.max(1, (t.base * distance(e.touches[0], e.touches[1])) / t.pinch)));
        }}
        onTouchEnd={(e) => {
          const t = touch.current;
          if (t.pinch !== null) {
            if (e.touches.length === 0) touch.current = { ...t, pinch: null };
            return;
          }
          const delta = e.changedTouches[0].clientX - t.x;
          if (zoom === 1 && Math.abs(delta) > 60) go(delta < 0 ? 1 : -1);
        }}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
      >
        {image ? (
          // The key replays the 3D opening each time the picture changes.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image.url} src={image.url} alt={image.note ?? "Picture"} style={{ transform: `scale(${zoom})` }} className="viewer-in max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-transform" />
        ) : (
          <p className="text-white/60">No pictures yet. Tap + to add one.</p>
        )}
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
          <div className="flex items-center gap-3">
            {images.length > 1 && <RoundButton icon="left" label="Previous" disabled={index === 0} onClick={() => go(-1)} size="lg" className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />}
            <RoundButton icon="download" label="Download" onClick={save} size="lg" className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />
            {onSetDefault && (image.id || image.tmdbPath) && (
              <RoundButton icon="star" label={image.isDefault ? "Default" : "Set as default"} disabled={image.isDefault} pressed={image.isDefault} onClick={() => onSetDefault(image)} size="lg" className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />
            )}
            {onNote && image.id && <RoundButton icon="note" label="Note" onClick={() => { setDraft(image.note ?? ""); setEditing(true); }} size="lg" className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />}
            {onDelete && image.id && (
              <RoundButton icon="trash" label="Delete" size="lg" className="bg-white/15 !text-red-300 dark:bg-white/15"
                onClick={() => { onDelete(image); if (images.length === 1) onClose(); else go(index === images.length - 1 ? -1 : 0); }} />
            )}
            {images.length > 1 && <RoundButton icon="right" label="Next" disabled={index === images.length - 1} onClick={() => go(1)} size="lg" className="bg-white/15 text-white dark:bg-white/15 dark:text-white" />}
          </div>
        )}
      </div>
    </div>
  );
}
