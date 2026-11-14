// app/session/page.tsx
// One viewing in full: its ticket stubs, photos with notes, seats and details.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import BackLink from "@/components/BackLink";
import CropDialog from "@/components/CropDialog";
import ImageViewer from "@/components/ImageViewer";
import { seatLabel } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { convertImage, PHOTO_PRESET } from "@/lib/images/convert";
import type { StoredImage } from "@/lib/ports/images";
import type { ViewingSummary } from "@/lib/ports/log";
import { services } from "@/lib/services";

type Gallery = { kind: "ticket" | "photo"; start: number } | null;

function SessionView() {
  const ready = useRequireSession();
  const id = useSearchParams().get("id");
  const [viewing, setViewing] = useState<{ mediaId: string; title: string; posterPath: string | null; summary: ViewingSummary } | null>(null);
  const [tickets, setTickets] = useState<StoredImage[]>([]);
  const [photos, setPhotos] = useState<StoredImage[]>([]);
  const [gallery, setGallery] = useState<Gallery>(null);
  const [crop, setCrop] = useState<{ file: File; kind: "photo" | "ticket" } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const stubInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    (async () => {
      const found = await services.log.getViewing(id);
      if (cancelled) return;
      if (!found.ok) return setProblem(found.error);
      const detail = await services.log.titleDetail(found.value.mediaId);
      if (cancelled) return;
      if (!detail.ok) return setProblem(detail.error);
      const summary = detail.value.viewings.find((v) => v.id === id);
      if (summary) setViewing({ mediaId: detail.value.mediaId, title: detail.value.title, posterPath: detail.value.posterPath, summary });
      const [t, p] = await Promise.all([services.images.list({ sessionId: id }, ["ticket"]), services.images.list({ sessionId: id }, ["photo"])]);
      if (cancelled) return;
      if (t.ok) setTickets(t.value);
      if (p.ok) setPhotos(p.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  async function addPicture(blob: Blob, kind: "photo" | "ticket") {
    if (!id) return;
    setCrop(null);
    const small = kind === "photo" ? await convertImage(blob, PHOTO_PRESET) : blob;
    const res = await services.images.add({ sessionId: id }, kind, small, null);
    if (res.ok) setReload((n) => n + 1);
    else setProblem(res.error);
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No viewing selected.</main>;

  const shown = gallery ? (gallery.kind === "ticket" ? tickets : photos) : [];
  const v = viewing?.summary;
  const refresh = () => setReload((n) => n + 1);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-24 pt-6">
      <BackLink />
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {viewing && v && (
        <>
          <div className="flex gap-4">
            {viewing.posterPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tmdbImageUrl(viewing.posterPath, "w342") ?? ""} alt="" className="w-28 rounded-2xl" />
            )}
            <div className="flex flex-col gap-1">
              <Link href={`/title/?id=${viewing.mediaId}`} className="font-serif text-3xl leading-tight tracking-tight">{viewing.title}</Link>
              <span className="text-sm text-neutral-500">{[v.watchedOn ?? "Date unknown", v.watchedAt].filter(Boolean).join(" · ")}</span>
              {v.rating !== null && <span className="text-sm">★ {v.rating}</span>}
            </div>
          </div>

          <p className="text-sm text-neutral-500">
            {v.venueId ? <Link href={`/venue/?id=${v.venueId}`} className="underline">{v.venue}</Link> : v.venue}
            {[v.auditorium, v.primaryFormat].filter(Boolean).length > 0 && ` · ${[v.auditorium, v.primaryFormat].filter(Boolean).join(" · ")}`}
          </p>
          {v.seats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {v.seats.map((seat, i) => <span key={i} className="rounded-full border border-neutral-300 px-3 py-0.5 text-sm dark:border-neutral-700">{seatLabel(seat)}</span>)}
            </div>
          )}
          {v.notes && <p className="text-sm">{v.notes}</p>}
          <Link href={`/entry/?id=${id}`} className="self-start rounded-xl border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">Edit viewing</Link>

          <section className="flex flex-col gap-2">
            <h2 className="font-serif text-xl">Ticket stubs</h2>
            {tickets.length === 0 && <p className="text-sm text-neutral-500">No stubs saved.</p>}
            <input ref={stubInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, kind: "ticket" }); e.target.value = ""; }} />
            <button type="button" onClick={() => stubInput.current?.click()} className="self-start rounded-full border border-neutral-400 px-4 py-1.5 text-sm">Add a stub</button>
            <ul className="-mx-5 flex gap-2 overflow-x-auto px-5">
              {tickets.map((image, i) => (
                <li key={image.id} className="shrink-0">
                  <button type="button" onClick={() => setGallery({ kind: "ticket", start: i })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.note ?? "Ticket stub"} className={`h-40 rounded-lg ${image.isDefault ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-serif text-xl">Photos</h2>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, kind: "photo" }); e.target.value = ""; }} />
            <button type="button" onClick={() => input.current?.click()} className="self-start rounded-full border border-neutral-400 px-4 py-1.5 text-sm">Add a photo</button>
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((image, i) => (
                <li key={image.id}>
                  <button type="button" onClick={() => setGallery({ kind: "photo", start: i })} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.note ?? "Photo"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {crop && <CropDialog file={crop.file} aspect={crop.kind === "photo" ? 1 : 3 / 4} maxEdge={crop.kind === "photo" ? 2000 : 4000} title={crop.kind === "photo" ? "Frame your photo" : "Frame your stub"} onCancel={() => setCrop(null)} onDone={(blob) => addPicture(blob, crop.kind)} />}
      {gallery && shown.length > 0 && (
        <ImageViewer
          images={shown}
          start={gallery.start}
          onClose={() => setGallery(null)}
          onSetDefault={async (image) => { if (image.id && id) { await services.images.setDefault({ sessionId: id }, image.id); refresh(); } }}
          onNote={async (image, note) => { if (image.id) { await services.images.setNote(image.id, note); refresh(); } }}
          onDelete={async (image) => { if (image.id) { await services.images.remove(image.id); refresh(); } }}
        />
      )}
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionView />
    </Suspense>
  );
}
