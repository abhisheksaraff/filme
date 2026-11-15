// components/SessionPicturesEditor.tsx
// The edit page's photos and ticket stubs for one saved viewing: see them, add more, set the main one, add notes, delete.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useCallback, useEffect, useRef, useState } from "react";
import CropDialog from "@/components/CropDialog";
import ImageViewer from "@/components/ImageViewer";
import { toast } from "@/components/Toast";
import { convertImage, PHOTO_PRESET } from "@/lib/images/convert";
import type { StoredImage } from "@/lib/ports/images";
import { services } from "@/lib/services";

type Kind = "photo" | "ticket";

export default function SessionPicturesEditor({ sessionId }: { sessionId: string }) {
  const [lists, setLists] = useState<Record<Kind, StoredImage[]>>({ photo: [], ticket: [] });
  const [viewing, setViewing] = useState<{ kind: Kind; start: number } | null>(null);
  const [crop, setCrop] = useState<{ file: File; kind: Kind } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const stubInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([services.images.list({ sessionId }, ["photo"]), services.images.list({ sessionId }, ["ticket"])]);
    setLists({ photo: p.ok ? p.value : [], ticket: t.ok ? t.value : [] });
  }, [sessionId]);

  useEffect(() => {
    // Loaded after the first paint so the form does not wait on the pictures.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function add(blob: Blob, kind: Kind) {
    setCrop(null);
    const body = kind === "photo" ? await convertImage(blob, PHOTO_PRESET) : blob;
    const res = await services.images.add({ sessionId }, kind, body, null);
    if (res.ok) {
      await load();
      toast(kind === "photo" ? "Photo added" : "Stub added");
    } else setProblem(res.error);
  }

  const thumb = "block h-14 w-14 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800";
  const plus = "flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-xl text-white dark:bg-white dark:text-neutral-950";

  function row(kind: Kind, label: string, input: React.RefObject<HTMLInputElement | null>) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs text-neutral-500">{label}</h2>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, kind }); e.target.value = ""; }} />
        <ul className="flex flex-wrap gap-2">
          {lists[kind].map((image, i) => (
            <li key={image.id}>
              <button type="button" className={thumb} aria-label={image.note ?? `${label} ${i + 1}`} onClick={() => setViewing({ kind, start: i })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
          <li><button type="button" className={plus} aria-label={`Add to ${label.toLowerCase()}`} onClick={() => input.current?.click()}>+</button></li>
        </ul>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {row("photo", "Photos", photoInput)}
      {row("ticket", "Ticket stubs", stubInput)}
      {crop && (
        <CropDialog file={crop.file} aspect={crop.kind === "photo" ? 1 : 3 / 4} maxEdge={crop.kind === "photo" ? 2000 : 4000}
          title={crop.kind === "photo" ? "Frame your photo" : "Frame your stub"} onCancel={() => setCrop(null)} onDone={(blob) => add(blob, crop.kind)} />
      )}
      {viewing && lists[viewing.kind].length > 0 && (
        <ImageViewer
          images={lists[viewing.kind]}
          start={viewing.start}
          onClose={() => setViewing(null)}
          onAdd={() => (viewing.kind === "ticket" ? stubInput : photoInput).current?.click()}
          onSetDefault={async (image) => { if (image.id) { await services.images.setDefault({ sessionId }, image.id); await load(); } }}
          onNote={async (image, note) => { if (image.id) { await services.images.setNote(image.id, note); await load(); } }}
          onDelete={async (image) => { if (image.id) { await services.images.remove(image.id); await load(); } }}
        />
      )}
    </div>
  );
}
