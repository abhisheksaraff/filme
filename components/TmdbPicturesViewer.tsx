// components/TmdbPicturesViewer.tsx
// Every TMDB poster or cover for a title you have not added yet, in the full-screen viewer. Nothing is saved, so you can only look and download.
"use client";

import { useEffect, useState } from "react";
import ImageViewer, { type ViewerImage } from "@/components/ImageViewer";
import Portal from "@/components/Portal";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CatalogKind } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

interface Props {
  kind: CatalogKind;
  tmdbId: number;
  shape: "poster" | "backdrop";
  /** The picture on the page now, so the viewer opens on it. */
  currentPath: string | null;
  onClose: () => void;
}

export default function TmdbPicturesViewer({ kind, tmdbId, shape, currentPath, onClose }: Props) {
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.catalog.images({ kind, tmdbId }).then((res) => {
      if (!cancelled) setPaths(res.ok ? (shape === "poster" ? res.value.posters : res.value.backdrops) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, tmdbId, shape]);

  if (!paths) {
    return (
      <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-sm text-white/70" role="status">Loading pictures…</div>
      </Portal>
    );
  }

  // The picture the page shows may be missing from TMDB's list (it leaves some languages out), so it is put first and the viewer opens on exactly it.
  const list = currentPath && !paths.includes(currentPath) ? [currentPath, ...paths] : paths;
  const images = list.map((path): ViewerImage => ({ url: tmdbImageUrl(path, "w780") ?? "", tmdbPath: path, isDefault: false })).filter((image) => image.url !== "");
  const start = Math.max(0, list.findIndex((path) => path === currentPath));
  return <ImageViewer images={images} start={start} onClose={onClose} />;
}
