// components/PicturesViewer.tsx
// Every poster or cover for a title in the full-screen viewer: yours first, then TMDB's. Set one as the main.
"use client";

import { useEffect, useState } from "react";
import ImageViewer, { type ViewerImage } from "@/components/ImageViewer";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { toast } from "@/lib/toast";
import { services } from "@/lib/services";

interface Props {
  mediaId: string;
  tmdbId: number | null;
  category: string;
  kind: "poster" | "backdrop";
  /** The picture in use now, so the viewer opens on it. */
  currentPath: string | null;
  /** Called after a new main picture is chosen so the page can show it. */
  onChanged: () => void;
  onClose: () => void;
}

export default function PicturesViewer({ mediaId, tmdbId, category, kind, currentPath, onChanged, onClose }: Props) {
  const [images, setImages] = useState<ViewerImage[] | null>(null);
  const [reload, setReload] = useState(0);
  const word = kind === "poster" ? "Poster" : "Cover";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mine, theirs] = await Promise.all([
        services.images.list({ mediaId }, [kind]),
        tmdbId !== null && (category === "Movie" || category === "TV Show")
          ? services.catalog.images({ kind: category, tmdbId })
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const own = mine.ok ? mine.value.map((image): ViewerImage => ({ id: image.id, url: image.url, isDefault: image.isDefault })) : [];
      const paths = theirs && theirs.ok ? (kind === "poster" ? theirs.value.posters : theirs.value.backdrops) : [];
      // A TMDB picture is the main one only when none of your own is.
      const ownMain = own.some((image) => image.isDefault);
      const tmdb = paths.map((path): ViewerImage => ({
        url: tmdbImageUrl(path, "w780") ?? "",
        tmdbPath: path,
        isDefault: !ownMain && path === currentPath,
      }));
      setImages([...own, ...tmdb].filter((image) => image.url !== ""));
    })();
    return () => {
      cancelled = true;
    };
    // currentPath is only used to mark the main picture when the viewer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, tmdbId, category, kind, reload]);

  if (!images) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-sm text-white/70" role="status">Loading pictures…</div>;
  }

  const start = Math.max(0, images.findIndex((image) => image.isDefault));
  return (
    <ImageViewer
      images={images}
      start={start}
      onClose={onClose}
      onSetDefault={async (image) => {
        const res = image.id ? await services.images.setDefault({ mediaId }, image.id) : image.tmdbPath ? await services.images.useTmdbCover(mediaId, kind, image.tmdbPath) : null;
        if (res && res.ok) {
          toast(`${word} updated`);
          onChanged();
          setReload((n) => n + 1);
        }
      }}
    />
  );
}
