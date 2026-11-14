// components/CoverPicker.tsx
// Choose a title's poster or cover from TMDB's own pictures, or upload one of your own.
"use client";

import { useEffect, useRef, useState } from "react";
import CropDialog from "@/components/CropDialog";
import ImageViewer from "@/components/ImageViewer";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { StoredImage } from "@/lib/ports/images";
import { services } from "@/lib/services";

interface Props {
  mediaId: string;
  tmdbId: number | null;
  category: string;
  kind: "poster" | "backdrop";
  /** Called after a new default is chosen so the page can show it. */
  onChanged: () => void;
}

export default function CoverPicker({ mediaId, tmdbId, category, kind, onChanged }: Props) {
  const [mine, setMine] = useState<StoredImage[]>([]);
  const [tmdb, setTmdb] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [crop, setCrop] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const label = kind === "poster" ? "poster" : "cover";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    services.images.list({ mediaId }, [kind]).then((res) => {
      if (cancelled) return;
      if (res.ok) setMine(res.value);
      else setProblem(res.error);
    });
    if (tmdbId !== null && (category === "Movie" || category === "TV Show")) {
      services.catalog.images({ kind: category, tmdbId }).then((res) => {
        if (!cancelled && res.ok) setTmdb(kind === "poster" ? res.value.posters : res.value.backdrops);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, mediaId, tmdbId, category, kind, reload]);

  async function pickTmdb(path: string) {
    const res = await services.images.useTmdbCover(mediaId, kind, path);
    if (res.ok) {
      onChanged();
      setReload((n) => n + 1);
    } else setProblem(res.error);
  }

  async function saveCrop(blob: Blob) {
    setCrop(null);
    const added = await services.images.add({ mediaId }, kind, blob, null);
    if (!added.ok) return setProblem(added.error);
    const set = await services.images.setDefault({ mediaId }, added.value.id);
    if (!set.ok) return setProblem(set.error);
    onChanged();
    setReload((n) => n + 1);
  }

  const chip = "rounded-full border border-neutral-400 px-4 py-1.5 text-sm";
  const aspect = kind === "poster" ? 2 / 3 : 16 / 9;

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={`${chip} self-start`} onClick={() => setOpen((o) => !o)}>
        {open ? `Hide ${label} options` : `Change ${label}`}
      </button>
      {open && (
        <>
          {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
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
          <button type="button" className={`${chip} self-start`} onClick={() => input.current?.click()}>Upload your own</button>

          {mine.length > 0 && (
            <>
              <p className="text-xs text-neutral-500">Yours</p>
              <ul className="-mx-6 flex gap-2 overflow-x-auto px-6">
                {mine.map((image, i) => (
                  <li key={image.id} className="shrink-0">
                    <button type="button" onClick={() => setViewing(i)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" className={`h-32 rounded-lg object-cover ${image.isDefault ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tmdb.length > 0 && (
            <>
              <p className="text-xs text-neutral-500">From TMDB</p>
              <ul className="-mx-6 flex gap-2 overflow-x-auto px-6">
                {tmdb.map((path) => (
                  <li key={path} className="shrink-0">
                    <button type="button" onClick={() => pickTmdb(path)} aria-label={`Use this ${label}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tmdbImageUrl(path, "w342") ?? ""} alt="" loading="lazy" className="h-32 rounded-lg object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {crop && <CropDialog file={crop} aspect={aspect} maxEdge={kind === "poster" ? 1500 : 1920} title={`Frame your ${label}`} onCancel={() => setCrop(null)} onDone={saveCrop} />}
      {viewing !== null && (
        <ImageViewer
          images={mine}
          start={viewing}
          onClose={() => setViewing(null)}
          onSetDefault={async (image) => {
            if (!image.id) return;
            const res = await services.images.setDefault({ mediaId }, image.id);
            if (res.ok) {
              onChanged();
              setReload((n) => n + 1);
            }
          }}
          onDelete={async (image) => {
            if (!image.id) return;
            await services.images.remove(image.id);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
