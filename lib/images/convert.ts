// lib/images/convert.ts
// Shrinks and re-encodes images in the browser before upload, so storage holds WebP (or JPEG
// where the browser cannot encode WebP) instead of whatever the phone produced.

export interface ImagePreset {
  /** Longest side in pixels; smaller images are never enlarged. */
  maxEdge: number;
  /** Encoder quality from 0 to 1. */
  quality: number;
}

/** Ticket stubs are the primary record, so they keep the most detail. */
export const STUB_PRESET: ImagePreset = { maxEdge: 4000, quality: 0.92 };
export const PHOTO_PRESET: ImagePreset = { maxEdge: 2000, quality: 0.8 };
export const AVATAR_PRESET: ImagePreset = { maxEdge: 512, quality: 0.85 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = src;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Converts a data URL or Blob into a resized WebP/JPEG Blob. */
export async function convertImage(source: Blob | string, preset: ImagePreset): Promise<Blob> {
  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  try {
    const img = await loadImage(objectUrl ?? (source as string));
    const scale = Math.min(1, preset.maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images.");
    // A white backdrop keeps transparent areas from turning black when saved as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Safari cannot encode WebP and silently returns PNG, so check what actually came back.
    const webp = await encode(canvas, "image/webp", preset.quality);
    if (webp && webp.type === "image/webp") return webp;
    const jpeg = await encode(canvas, "image/jpeg", preset.quality);
    if (!jpeg) throw new Error("Could not convert this image.");
    return jpeg;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
