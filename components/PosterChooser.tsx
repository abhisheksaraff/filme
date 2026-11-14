// components/PosterChooser.tsx
// A sideways strip of posters or covers to pick from, with a + tile to use your own picture.
"use client";

import { useRef, useState } from "react";
import CropDialog from "@/components/CropDialog";
import Icon from "@/components/Icon";
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
  const input = useRef<HTMLInputElement>(null);
  const size = shape === "poster" ? "h-36 aspect-[2/3]" : "h-24 aspect-video";
  const selectedPath = choice?.kind === "tmdb" ? choice.path : choice === null ? defaultPath : null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-neutral-500">{title}</h2>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { setCrop(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        <li className="shrink-0">
          <button type="button" aria-label={`Upload your own ${shape === "poster" ? "poster" : "cover"}`} onClick={() => input.current?.click()}
            className={`${size} flex items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name="plus" size={18} /></span>
          </button>
        </li>
        {choice?.kind === "upload" && (
          <li className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={choice.url} alt="Your picture" className={`${size} rounded-xl object-cover ring-2 ring-neutral-950 dark:ring-white`} />
          </li>
        )}
        {paths.map((path) => (
          <li key={path} className="shrink-0">
            <button type="button" onClick={() => onChoose({ kind: "tmdb", path })} aria-label="Use this picture" aria-pressed={selectedPath === path}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tmdbImageUrl(path, "w342") ?? ""} alt="" loading="lazy" className={`${size} rounded-xl object-cover ${selectedPath === path ? "ring-2 ring-neutral-950 dark:ring-white" : ""}`} />
            </button>
          </li>
        ))}
      </ul>
      {crop && (
        <CropDialog file={crop} aspect={shape === "poster" ? 2 / 3 : 16 / 9} maxEdge={shape === "poster" ? 1500 : 1920}
          title={shape === "poster" ? "Frame your poster" : "Frame your cover"} onCancel={() => setCrop(null)}
          onDone={(blob) => { setCrop(null); onChoose({ kind: "upload", blob, url: URL.createObjectURL(blob) }); }} />
      )}
    </section>
  );
}
