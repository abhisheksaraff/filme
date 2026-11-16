// lib/color.ts
// Reads colours out of pictures on a hidden canvas: a poster's main colours for a story's background,
// and whether a picture is a true cut-out (see-through corners) that can be used as a sticker.

/** Decoded pictures need the server's permission to be read; without it these return null or false. */
function load(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function pixels(img: HTMLImageElement, size: number): Uint8ClampedArray | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  } catch {
    // The picture's server did not allow reading it.
    return null;
  }
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export interface Gradient {
  from: string;
  to: string;
}

/** A rich, dark gradient for a hue, dark enough that white text always reads on it. */
export function gradientFor(hue: number, saturation = 0.55): Gradient {
  const h = ((hue % 360) + 360) % 360;
  return { from: `hsl(${h} ${Math.round(saturation * 100)}% 30%)`, to: `hsl(${h} ${Math.round(saturation * 100)}% 12%)` };
}

const sampled = new Map<string, Gradient | null>();

/** The main colour of a picture as a dark gradient, or null when it cannot be read. */
export async function gradientFromPicture(url: string): Promise<Gradient | null> {
  if (sampled.has(url)) return sampled.get(url) ?? null;
  const img = await load(url);
  const data = img ? pixels(img, 24) : null;
  let result: Gradient | null = null;
  if (data) {
    // Colourful pixels count more than grey ones, so a mostly black poster with a red title still comes out red.
    let x = 0, y = 0, weight = 0, sat = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const w = s * (1 - Math.abs(l - 0.5) * 1.6);
      if (w <= 0.02) continue;
      x += Math.cos((h * Math.PI) / 180) * w;
      y += Math.sin((h * Math.PI) / 180) * w;
      weight += w;
      sat += s * w;
    }
    if (weight > 1) result = gradientFor((Math.atan2(y, x) * 180) / Math.PI, Math.min(0.7, Math.max(0.35, sat / weight)));
  }
  sampled.set(url, result);
  return result;
}

/** True when the picture has see-through corners and edges, so it can sit on a colour as a sticker without a box around it. */
export async function isCutout(url: string): Promise<boolean> {
  const img = await load(url);
  if (!img || img.width < 120 || img.height < 120) return false;
  const size = 40;
  const data = pixels(img, size);
  if (!data) return false;
  const alphaAt = (px: number, py: number) => data[(py * size + px) * 4 + 3];
  const last = size - 1, mid = Math.floor(size / 2);
  const probes = [[0, 0], [last, 0], [0, last], [last, last], [mid, 0], [mid, last], [0, mid], [last, mid]];
  const clear = probes.filter(([px, py]) => alphaAt(px, py) < 20).length;
  // Something must also be there: a picture that is entirely see-through is no use.
  let solid = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 200) solid++;
  return clear >= 7 && solid > size * size * 0.1;
}
