// components/ViewingPictures.tsx
// A viewing's photos and ticket stubs as a row of small round thumbnails; tapping one opens the viewer.
"use client";

import { useEffect, useState } from "react";
import ImageViewer from "@/components/ImageViewer";
import type { StoredImage } from "@/lib/ports/images";
import { services } from "@/lib/services";

export default function ViewingPictures({ sessionId }: { sessionId: string }) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [start, setStart] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([services.images.list({ sessionId }, ["photo"]), services.images.list({ sessionId }, ["ticket"])]).then(([p, t]) => {
      if (cancelled) return;
      setImages([...(p.ok ? p.value : []), ...(t.ok ? t.value : [])]);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (images.length === 0) return null;
  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Photos and stubs">
        {images.map((image, i) => (
          <li key={image.id}>
            <button type="button" onClick={() => setStart(i)} aria-label={image.note ?? `Picture ${i + 1}`} className="block h-12 w-12 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {start !== null && <ImageViewer images={images} start={start} onClose={() => setStart(null)} />}
    </>
  );
}
