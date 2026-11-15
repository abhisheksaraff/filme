// app/session/page.tsx
// One viewing in full: the title's cover and poster, its seats and details, ticket stubs, photos with
// notes, and a small map of where it was watched. Editing and deleting live here, not on the title page.
"use client";

import { scopeLabel } from "@/lib/domain/tv";
import RoundButton from "@/components/RoundButton";
import Link from "next/link";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon from "@/components/Icon";
import TitleHero from "@/components/TitleHero";
import WatchButton from "@/components/WatchButton";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ConfirmPopup } from "@/components/Popup";
import CropDialog from "@/components/CropDialog";
import ImageViewer from "@/components/ImageViewer";
import { AddTile } from "@/components/PictureTiles";
import { toast } from "@/components/Toast";
import { seatLabel } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { convertImage, PHOTO_PRESET } from "@/lib/images/convert";
import type { StoredImage } from "@/lib/ports/images";
import type { VenuePoint } from "@/lib/ports/browse";
import type { ViewingSummary } from "@/lib/ports/log";
import { services } from "@/lib/services";

type Gallery = { kind: "ticket" | "photo"; start: number } | null;

/** Finds the venue's pin; a venue without a position is looked up on the map service and remembered. */
async function locateVenue(venueId: string): Promise<VenuePoint | null> {
  const points = await services.browse.venuePoints();
  const known = points.ok ? points.value.find((p) => p.id === venueId) : undefined;
  if (known) return known;

  const missing = await services.browse.unlocatedVenues(200);
  const venue = missing.ok ? missing.value.find((v) => v.id === venueId) : undefined;
  if (!venue) return null;
  // The full address can miss where the venue's name alone is known, so try both.
  let found = await services.geo.locate([venue.name, venue.address].filter(Boolean).join(", "));
  if (!(found.ok && found.value) && venue.address) found = await services.geo.locate(venue.name);
  if (!found.ok || !found.value) return null;
  await services.browse.setVenueLocation(venueId, found.value);
  const again = await services.browse.venuePoints();
  return again.ok ? (again.value.find((p) => p.id === venueId) ?? null) : null;
}

function SessionView() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [viewing, setViewing] = useState<{ mediaId: string; title: string; posterPath: string | null; backdropPath: string | null; tmdbId: number | null; category: string; year: string | null; season: number | null; episode: number | null; summary: ViewingSummary } | null>(null);
  const [venuePoint, setVenuePoint] = useState<VenuePoint | null>(null);
  const [tickets, setTickets] = useState<StoredImage[]>([]);
  const [photos, setPhotos] = useState<StoredImage[]>([]);
  const [gallery, setGallery] = useState<Gallery>(null);
  const [crop, setCrop] = useState<{ file: File; kind: "photo" | "ticket" } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Taps on a format or extra carry a new stamp each visit so Search applies them every time.
  const [stamp] = useState(() => Date.now());
  const [deleting, setDeleting] = useState(false);
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
      if (summary) {
        setViewing({
          mediaId: detail.value.mediaId,
          title: detail.value.title,
          posterPath: detail.value.posterPath,
          backdropPath: detail.value.backdropPath,
          tmdbId: detail.value.tmdbId,
          category: detail.value.category,
          year: detail.value.releaseDate?.slice(0, 4) ?? null,
          season: found.value.entry.season,
          episode: found.value.entry.episode,
          summary,
        });
        if (summary.venueId) locateVenue(summary.venueId).then((point) => !cancelled && setVenuePoint(point));
      }
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
    if (res.ok) {
      setReload((n) => n + 1);
      toast(kind === "photo" ? "Photo added" : "Stub added");
    } else setProblem(res.error);
  }

  async function deleteViewing() {
    if (!id || !viewing) return;
    setDeleting(true);
    const res = await services.log.deleteViewing(id);
    if (!res.ok) {
      setDeleting(false);
      setConfirmDelete(false);
      return setProblem(res.error);
    }
    // replace, so Back from the movie page does not return to a viewing that no longer exists.
    router.replace(`/title/?id=${viewing.mediaId}`);
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No viewing selected.</main>;

  const shown = gallery ? (gallery.kind === "ticket" ? tickets : photos) : [];
  const v = viewing?.summary;
  const refresh = () => setReload((n) => n + 1);

  const pinIcon = v ? (KIND_ICON[viewing?.category ?? "Movie"] ?? "film") : "film";

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 pb-4">
      {problem && <p role="alert" className="px-5 text-sm text-red-600">{problem}</p>}
      {viewing && v && (
        <div className="reveal flex flex-col gap-5">
          <TitleHero
            backdropUrl={tmdbImageUrl(viewing.backdropPath, "w780") ?? tmdbImageUrl(viewing.posterPath, "w780")}
            posterUrl={tmdbImageUrl(viewing.posterPath, "w342")}
            title={viewing.title}
            titleHref={`/title/?id=${viewing.mediaId}`}
            subtitle={[viewing.category === "TV Show" ? scopeLabel(viewing.season, viewing.episode) : null, v.watchedOn ?? "Date unknown", v.watchedAt, v.rating !== null ? `★ ${v.rating}` : null].filter(Boolean).join(" · ")}
          />

          <div className="flex flex-col gap-5 px-5">
            {v.venueId && v.venue && (
              <section className="flex flex-col gap-2">
                {venuePoint && (
                  <div className="relative h-44 overflow-hidden rounded-3xl bg-neutral-200 dark:bg-neutral-800">
                    <FlatMap points={[venuePoint]} focus={{ lon: venuePoint.longitude, lat: venuePoint.latitude, zoom: 14 }} still pinIcon={pinIcon} className="h-44" />
                    {/* The whole tile opens the map on this venue. */}
                    <Link href={`/map/?venue=${venuePoint.id}`} aria-label={`Show ${v.venue} on the map`} className="absolute inset-0 z-30" />
                  </div>
                )}
                <Link href={`/venue/?id=${v.venueId}`} className="font-serif text-lg leading-tight">
                  {[v.venue, v.auditorium].filter(Boolean).join(" · ")}
                </Link>
              </section>
            )}

            {(v.seats.length > 0 || v.totalTickets || v.primaryFormat || v.addons.length > 0) && (
              <div className="flex flex-col gap-2">
                {v.seats.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {v.seats.map((seat, i) => <span key={i} className="rounded-full bg-neutral-950 px-3 py-0.5 text-sm text-white dark:bg-white dark:text-neutral-950">{seatLabel(seat)}</span>)}
                  </div>
                ) : v.totalTickets ? (
                  <p className="text-sm">{v.totalTickets} {v.totalTickets === 1 ? "ticket" : "tickets"}</p>
                ) : null}
                {(v.primaryFormat || v.addons.length > 0) && (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {/* Each opens Search with just that format or extra. `at` lets the same tap count again later. */}
                    {v.primaryFormat && <Link href={`/search/?format=${encodeURIComponent(v.primaryFormat)}&at=${stamp}`} className="underline decoration-neutral-300 underline-offset-4">{v.primaryFormat}</Link>}
                    {v.addons.map((extra) => <Link key={extra} href={`/search/?extra=${encodeURIComponent(extra)}&at=${stamp}`} className="underline decoration-neutral-300 underline-offset-4">{extra}</Link>)}
                  </p>
                )}
              </div>
            )}

            {v.notes && <p className="text-sm">{v.notes}</p>}

            {/* Photos are small circles; the last is a plus. */}
            <section aria-label="Photos" className="flex flex-col gap-2">
              <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, kind: "photo" }); e.target.value = ""; }} />
              <ul className="flex flex-wrap gap-2">
                {photos.map((image, i) => (
                  <li key={image.id}>
                    <button type="button" onClick={() => setGallery({ kind: "photo", start: i })} aria-label={image.note ?? `Photo ${i + 1}`} className="block h-14 w-14 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" aria-label="Add a photo" title="Add a photo" onClick={() => input.current?.click()} className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
                    <Icon name="plus" size={20} />
                  </button>
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="font-serif text-xl">Ticket stubs</h2>
              <input ref={stubInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ file: f, kind: "ticket" }); e.target.value = ""; }} />
              <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1">
                {tickets.map((image, i) => (
                  <li key={image.id} className="shrink-0">
                    <button type="button" onClick={() => setGallery({ kind: "ticket", start: i })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.note ?? "Ticket stub"} className={`h-40 rounded-lg ${image.isDefault ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`} />
                    </button>
                  </li>
                ))}
                <li className="shrink-0"><AddTile label="Add a stub" className="h-40 w-28" onClick={() => stubInput.current?.click()} /></li>
              </ul>
            </section>

            <div className="flex items-center justify-end gap-3">
              {viewing.season !== null && viewing.episode !== null && viewing.tmdbId !== null && viewing.category === "TV Show" && (
                <WatchButton watch={{ tmdbId: viewing.tmdbId, kind: "TV Show", title: viewing.title, year: viewing.year, season: viewing.season, episode: viewing.episode }} />
              )}
              <RoundButton icon="edit" label="Edit viewing" href={`/entry/?id=${id}`} size="lg" className="!bg-black !text-white" />
              <RoundButton icon="trash" label="Delete viewing" size="lg" onClick={() => setConfirmDelete(true)} className="!bg-black !text-red-500" />
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmPopup
          title="Delete this viewing?"
          message="You can restore it from Watched for 24 hours."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={deleteViewing}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {crop && <CropDialog file={crop.file} aspect={crop.kind === "photo" ? 1 : 3 / 4} maxEdge={crop.kind === "photo" ? 2000 : 4000} title={crop.kind === "photo" ? "Frame your photo" : "Frame your stub"} onCancel={() => setCrop(null)} onDone={(blob) => addPicture(blob, crop.kind)} />}
      {gallery && shown.length > 0 && (
        <ImageViewer
          images={shown}
          start={gallery.start}
          onClose={() => setGallery(null)}
          onAdd={() => (gallery.kind === "ticket" ? stubInput : input).current?.click()}
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
