// components/PicturesViewer.tsx
// A title's posters or covers in the full-screen viewer: your own upload first, then TMDB's. Upload, make default, delete.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useEffect, useRef, useState } from "react";
import Portal from "@/components/Portal";
import CropDialog from "@/components/CropDialog";
import ImageViewer, { type ViewerImage } from "@/components/ImageViewer";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { StoredImage } from "@/lib/ports/images";
import { toast } from "@/lib/toast";
import { services } from "@/lib/services";

interface Props {
  mediaId: string;
  tmdbId: number | null;
  category: string;
  kind: "poster" | "backdrop";
  /** The picture in use now, so the viewer opens on it. */
  currentPath: string | null;
  /** Called after the main picture changes so the page can show it. */
  onChanged: () => void;
  onClose: () => void;
}

export default function PicturesViewer({ mediaId, tmdbId, category, kind, currentPath, onChanged, onClose }: Props) {
  const [mine, setMine] = useState<StoredImage[] | null>(null);
  const [theirs, setTheirs] = useState<string[] | null>(null);
  // The TMDB picture in use. Starts as the title's own and follows choices made here, before the page reloads.
  const [main, setMain] = useState<string | null>(currentPath);
  const [reload, setReload] = useState(0);
  const [crop, setCrop] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const word = kind === "poster" ? "Poster" : "Cover";

  useEffect(() => {
    let cancelled = false;
    services.images.list({ mediaId }, [kind]).then((res) => !cancelled && res.ok && setMine(res.value));
    return () => {
      cancelled = true;
    };
  }, [mediaId, kind, reload]);

  useEffect(() => {
    if (tmdbId === null || (category !== "Movie" && category !== "TV Show")) {
      // Nothing to fetch: custom titles only have your own pictures.
      const none = setTimeout(() => setTheirs([]), 0);
      return () => clearTimeout(none);
    }
    let cancelled = false;
    services.catalog.images({ kind: category, tmdbId }).then((res) => {
      if (!cancelled) setTheirs(res.ok ? (kind === "poster" ? res.value.posters : res.value.backdrops) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, category, kind]);

  if (!mine || !theirs) {
    return (
      <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-sm text-white/70" role="status">Loading pictures…</div>
      </Portal>
    );
  }

  const ownMain = mine.some((image) => image.isDefault);
  const images: ViewerImage[] = [
    ...mine.map((image): ViewerImage => ({ id: image.id, url: image.url, isDefault: image.isDefault })),
    ...theirs
      .map((path): ViewerImage => ({ url: tmdbImageUrl(path, "w780") ?? "", tmdbPath: path, isDefault: !ownMain && path === main }))
      .filter((image) => image.url !== ""),
  ];
  const start = Math.max(0, images.findIndex((image) => image.isDefault));

  function changed(message: string) {
    toast(message);
    onChanged();
    setReload((n) => n + 1);
  }

  async function chooseTmdb(path: string) {
    const res = await services.images.useTmdbCover(mediaId, kind, path);
    if (!res.ok) return setProblem(res.error);
    setMain(path);
    changed(`${word} updated`);
  }

  async function saveUpload(blob: Blob) {
    setCrop(null);
    // Adding replaces any earlier upload, so only the newest one is ever kept.
    const added = await services.images.add({ mediaId }, kind, blob, null);
    if (!added.ok) return setProblem(added.error);
    const set = await services.images.setDefault({ mediaId }, added.value.id);
    if (!set.ok) return setProblem(set.error);
    changed(`${word} updated`);
  }

  async function removeUpload(image: ViewerImage) {
    if (!image.id) return;
    const res = await services.images.remove(image.id);
    if (!res.ok) return setProblem(res.error);
    // If it was the main one, the title goes back to the picture TMDB lists as its own.
    if (image.isDefault && tmdbId !== null && (category === "Movie" || category === "TV Show")) {
      const details = await services.catalog.details({ kind: category, tmdbId });
      const path = details.ok ? (kind === "poster" ? details.value.posterPath : details.value.backdropPath) : null;
      if (path) {
        await services.images.useTmdbCover(mediaId, kind, path);
        setMain(path);
      }
    }
    changed(`${word} deleted`);
  }

  return (
    // The key makes the viewer reopen on the main picture after an upload, a new default or a deletion.
    <>
      <ImageViewer
        key={reload}
        images={images}
        start={start}
        onClose={onClose}
        onAdd={() => input.current?.click()}
        onSetDefault={async (image) => {
          if (image.id) {
            const res = await services.images.setDefault({ mediaId }, image.id);
            if (!res.ok) return setProblem(res.error);
            changed(`${word} updated`);
          } else if (image.tmdbPath) await chooseTmdb(image.tmdbPath);
        }}
        onDelete={removeUpload}
        deleteMessage="Your upload is removed and TMDB's picture becomes the main one again."
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          setCrop(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {crop && (
        <CropDialog file={crop} aspect={kind === "poster" ? 2 / 3 : 16 / 9} maxEdge={kind === "poster" ? 1500 : 1920} title={`Frame your ${word.toLowerCase()}`} onCancel={() => setCrop(null)} onDone={saveUpload} />
      )}
    </>
  );
}
