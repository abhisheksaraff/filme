// components/PosterChooser.tsx
// A sideways strip of posters or covers. Tapping one opens the full-screen viewer, where it can be made the main picture or you can upload your own.
"use client";

import { useRef, useState } from "react";
import CropDialog from "@/components/CropDialog";
import ImageViewer, { type ViewerImage } from "@/components/ImageViewer";
import { AddTile, MainBadge } from "@/components/PictureTiles";
import { toast } from "@/components/Toast";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";

/** What has been picked: one of TMDB's pictures, or a picture of your own, or nothing (the default). */
export type CoverChoice = { kind: "tmdb"; path: string } | { kind: "upload"; blob: Blob; url: string } | null;

interface Props {
  title: string;
  shape: "poster" | "backdrop";
  /** TMDB pictures to offer; empty for a title that is not on TMDB. */
  paths: string[];
  /** The picture TMDB uses by default, shown as selected until something else is picked. */
  defaultPath: string | null;
  choice: CoverChoice;
  onChoose: (choice: CoverChoice) => void;
}

export default function PosterChooser({ title, shape, paths, defaultPath, choice, onChoose }: Props) {
  const [crop, setCrop] = useState<File | null>(null);
  // Which picture the viewer opens on; null while it is closed.
  const [viewing, setViewing] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const size = shape === "poster" ? "h-36 aspect-[2/3]" : "h-24 aspect-video";
  const word = shape === "poster" ? "poster" : "cover";
  const selectedPath = choice?.kind === "tmdb" ? choice.path : choice === null ? defaultPath : null;

  // Your own upload comes first, then TMDB's, the same order the title page uses.
  const images: ViewerImage[] = [
    ...(choice?.kind === "upload" ? [{ id: "upload", url: choice.url, isDefault: true } satisfies ViewerImage] : []),
    ...paths.map((path): ViewerImage => ({ url: tmdbImageUrl(path, "w780") ?? "", tmdbPath: path, isDefault: path === selectedPath })),
  ].filter((image) => image.url !== "");

  function pick(next: CoverChoice) {
    onChoose(next);
    toast(`${word === "poster" ? "Poster" : "Cover"} updated`);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-neutral-500">{title}</h2>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { setCrop(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      {/* The padding keeps the selected outline from being cut off by the scrolling row. */}
      <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 py-2">
        {images.map((image, i) => (
          <li key={image.tmdbPath ?? image.id} className="relative shrink-0">
            <button type="button" onClick={() => setViewing(i)} aria-label={`View this ${word}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.id ? image.url : (tmdbImageUrl(image.tmdbPath ?? null, "w342") ?? "")} alt="" loading="lazy" className={`${size} rounded-xl object-cover ${image.isDefault ? "ring-2 ring-neutral-950 dark:ring-white" : ""}`} />
            </button>
            {image.isDefault && <MainBadge />}
          </li>
        ))}
        <li className="shrink-0">
          <AddTile label={`Upload your own ${word}`} className={size} onClick={() => input.current?.click()} />
        </li>
      </ul>
      {viewing !== null && (
        <ImageViewer
          images={images}
          start={viewing}
          onClose={() => setViewing(null)}
          onAdd={() => input.current?.click()}
          onSetDefault={(image) => (image.tmdbPath ? pick({ kind: "tmdb", path: image.tmdbPath }) : undefined)}
          onDelete={() => { onChoose(null); setViewing(null); }}
          deleteMessage={`Your ${word} is removed and the default one is used again.`}
        />
      )}
      {crop && (
        <CropDialog file={crop} aspect={shape === "poster" ? 2 / 3 : 16 / 9} maxEdge={shape === "poster" ? 1500 : 1920}
          title={shape === "poster" ? "Frame your poster" : "Frame your cover"} onCancel={() => setCrop(null)}
          onDone={(blob) => { setCrop(null); setViewing(null); pick({ kind: "upload", blob, url: URL.createObjectURL(blob) }); }} />
      )}
    </section>
  );
}
