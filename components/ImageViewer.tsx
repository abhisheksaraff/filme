// components/ImageViewer.tsx
// Full-screen picture viewer: swipe between images, pinch to zoom, save, set as default, add a note.
"use client";

import { useRef, useState } from "react";
import { downloadBlob } from "@/lib/ics";

export interface ViewerImage {
  id?: string;
  url: string;
  note?: string | null;
  isDefault?: boolean;
}

interface Props {
  images: ViewerImage[];
  start: number;
  onClose: () => void;
  onSetDefault?: (image: ViewerImage) => void;
  onNote?: (image: ViewerImage, note: string | null) => void;
  onDelete?: (image: ViewerImage) => void;
}

const MAX_ZOOM = 5;

const distance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export default function ImageViewer({ images, start, onClose, onSetDefault, onNote, onDelete }: Props) {
  const [index, setIndex] = useState(Math.min(start, images.length - 1));
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const touch = useRef<{ x: number; pinch: number | null; base: number }>({ x: 0, pinch: null, base: 1 });

  const image = images[index];
  if (!image) return null;

  function go(by: number) {
    setZoom(1);
    setEditing(false);
    setIndex((i) => Math.min(images.length - 1, Math.max(0, i + by)));
  }

  async function save() {
    try {
      const blob = await (await fetch(image.url)).blob();
      downloadBlob(`filme-${image.id ?? index + 1}.${blob.type.split("/")[1] ?? "jpg"}`, blob);
    } catch {
      window.open(image.url, "_blank");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-sm">
        <span className="text-white/60">{index + 1} / {images.length}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="px-2 text-2xl">✕</button>
      </div>

      <div
        className="flex flex-1 touch-none items-center justify-center overflow-hidden"
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
        {/* The key replays the 3D opening each time the picture changes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={image.url} src={image.url} alt={image.note ?? "Picture"} style={{ transform: `scale(${zoom})` }} className="viewer-in max-h-full max-w-full object-contain transition-transform" />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-sm">
        {image.note && !editing && <p className="text-center text-white/80">{image.note}</p>}
        {editing && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onNote?.(image, draft.trim() || null);
              setEditing(false);
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Add a note" className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-base" />
            <button type="submit" className="rounded-xl bg-white px-4 text-neutral-900">Save</button>
          </form>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="px-3 py-1 disabled:opacity-30">‹ Prev</button>
          <button type="button" onClick={save} className="rounded-full border border-white/40 px-4 py-1.5">Download</button>
          {onSetDefault && image.id && (
            <button type="button" disabled={image.isDefault} onClick={() => onSetDefault(image)} className="rounded-full border border-white/40 px-4 py-1.5 disabled:opacity-40">
              {image.isDefault ? "Default" : "Make default"}
            </button>
          )}
          {onNote && image.id && (
            <button type="button" onClick={() => { setDraft(image.note ?? ""); setEditing(true); }} className="rounded-full border border-white/40 px-4 py-1.5">Note</button>
          )}
          {onDelete && image.id && (
            <button type="button" onClick={() => { onDelete(image); if (images.length === 1) onClose(); else go(index === images.length - 1 ? -1 : 0); }} className="rounded-full border border-red-300/60 px-4 py-1.5 text-red-300">Delete</button>
          )}
          <button type="button" onClick={() => go(1)} disabled={index === images.length - 1} className="px-3 py-1 disabled:opacity-30">Next ›</button>
        </div>
      </div>
    </div>
  );
}
