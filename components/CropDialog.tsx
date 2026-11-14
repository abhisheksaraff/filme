// components/CropDialog.tsx
// Drag and zoom a picture inside a frame, then keep what the frame shows.
"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  file: Blob;
  /** Width divided by height of the frame; 1 is a square. */
  aspect: number;
  /** Longest side of the result in pixels. */
  maxEdge: number;
  title: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

const FRAME = 300;

export default function CropDialog({ file, aspect, maxEdge, title, onCancel, onDone }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const frameW = aspect >= 1 ? FRAME : FRAME * aspect;
  const frameH = aspect >= 1 ? FRAME / aspect : FRAME;

  useEffect(() => {
    const next = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setUrl(next);
    };
    img.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);

  // The picture covers the frame at zoom 1, then grows from there.
  const base = size ? Math.max(frameW / size.w, frameH / size.h) : 1;
  const scale = base * zoom;

  /** Keeps the frame inside the picture so no empty edge is ever saved. */
  const clamp = (x: number, y: number) => {
    if (!size) return { x, y };
    const maxX = Math.max(0, (size.w * scale - frameW) / 2);
    const maxY = Math.max(0, (size.h * scale - frameH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  async function finish() {
    if (!size || !url) return;
    setBusy(true);
    const img = new Image();
    img.src = url;
    await img.decode();
    const out = document.createElement("canvas");
    out.width = Math.round((frameW * maxEdge) / Math.max(frameW, frameH));
    out.height = Math.round((frameH * maxEdge) / Math.max(frameW, frameH));
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const pos = clamp(offset.x, offset.y);
    // Map the frame back onto the original picture.
    const sx = (size.w * scale - frameW) / 2 / scale - pos.x / scale;
    const sy = (size.h * scale - frameH) / 2 / scale - pos.y / scale;
    ctx.drawImage(img, sx, sy, frameW / scale, frameH / scale, 0, 0, out.width, out.height);
    out.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") onDone(webp);
        else out.toBlob((jpeg) => (jpeg ? onDone(jpeg) : setBusy(false)), "image/jpeg", 0.9);
      },
      "image/webp",
      0.9,
    );
  }

  const pos = clamp(offset.x, offset.y);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/90 p-6 text-white" role="dialog" aria-modal="true" aria-label={title}>
      <h2 className="font-serif text-xl">{title}</h2>
      <div
        className="relative touch-none overflow-hidden rounded-2xl bg-neutral-800"
        style={{ width: frameW, height: frameH }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
        onPointerMove={(e) => drag.current && setOffset(clamp(e.clientX - drag.current.x, e.clientY - drag.current.y))}
        onPointerUp={() => { drag.current = null; }}
      >
        {url && size && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            style={{ width: size.w * scale, height: size.h * scale, maxWidth: "none", transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            className="absolute left-1/2 top-1/2 select-none"
          />
        )}
      </div>
      <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="w-64" />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/40 px-5 py-2">Cancel</button>
        <button type="button" onClick={finish} disabled={busy || !size} className="rounded-xl bg-white px-5 py-2 text-neutral-900 disabled:opacity-50">{busy ? "Saving…" : "Use this"}</button>
      </div>
    </div>
  );
}
