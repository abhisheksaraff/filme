// components/ScopePicturesViewer.tsx
// A season's, episode's or collection's posters or covers in the full-screen viewer: your own upload first, then TMDB's.
// Upload, make default, delete. Like a title's own viewer, except the choice is kept for that page only.
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
  /** What the pictures belong to, such as "collection:10". */
  scope: string;
  kind: "poster" | "backdrop";
  /** TMDB's pictures for it, as image paths. */
  load: () => Promise<string[]>;
  /** The picture on the page now (a TMDB path or the link of an upload), so the viewer opens on it. */
  currentPath: string | null;
  /** Called after the main picture changes so the page can show it. */
  onChanged: () => void;
  onClose: () => void;
}

export default function ScopePicturesViewer({ scope, kind, load, currentPath, onChanged, onClose }: Props) {
  const [mine, setMine] = useState<StoredImage[] | null>(null);
  const [theirs, setTheirs] = useState<string[] | null>(null);
  const [main, setMain] = useState<string | null>(currentPath);
  const [reload, setReload] = useState(0);
  const [crop, setCrop] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const word = kind === "poster" ? "Poster" : "Cover";

  useEffect(() => {
    let cancelled = false;
    services.images.list({ scope }, [kind]).then((res) => !cancelled && res.ok && setMine(res.value));
    return () => {
      cancelled = true;
    };
  }, [scope, kind, reload]);

  useEffect(() => {
    let cancelled = false;
    load().then((paths) => !cancelled && setTheirs(paths));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, kind]);

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
    // The page's picture may be missing from TMDB's list, so it is put first and shows as the main one.
    ...(main && !main.startsWith("http") && !theirs.includes(main) ? [main, ...theirs] : theirs)
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
    const res = await services.images.useTmdbPicture(scope, kind, path);
    if (!res.ok) return setProblem(res.error);
    setMain(path);
    changed(`${word} updated`);
  }

  async function saveUpload(blob: Blob) {
    setCrop(null);
    // Adding replaces any earlier upload, so only the newest one is ever kept.
    const added = await services.images.add({ scope }, kind, blob, null);
    if (!added.ok) return setProblem(added.error);
    const set = await services.images.setDefault({ scope }, added.value.id);
    if (!set.ok) return setProblem(set.error);
    changed(`${word} updated`);
  }

  async function removeUpload(image: ViewerImage) {
    if (!image.id) return;
    const res = await services.images.remove(image.id);
    if (!res.ok) return setProblem(res.error);
    // If it was the main one, the page goes back to TMDB's own picture.
    if (image.isDefault) {
      await services.images.clearChoice(scope, kind);
      setMain(null);
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
            const res = await services.images.setDefault({ scope }, image.id);
            if (!res.ok) return setProblem(res.error);
            changed(`${word} updated`);
          } else if (image.tmdbPath) await chooseTmdb(image.tmdbPath);
        }}
        onDelete={removeUpload}
        deleteMessage="Your upload is removed and TMDB's picture is used again."
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
