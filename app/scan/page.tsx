// app/scan/page.tsx
// Reads ticket images (or starts blank), lets the user correct the result, and saves the viewing.

"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PosterChooser, { type CoverChoice } from "@/components/PosterChooser";
import RoundButton from "@/components/RoundButton";
import { toast } from "@/lib/toast";
import UploadToImages, { type FileProcessingError } from "@/components/UploadToImages";
import { OcrClient } from "@/lib/ocrClient";
import EntryForm from "@/components/EntryForm";
import LoadingOverlay from "@/components/LoadingOverlay";
import ImageViewer from "@/components/ImageViewer";
import { ConfirmPopup } from "@/components/Popup";
import { CancelButton, RescanButton } from "@/components/EntryActions";
import { TitleHits } from "@/components/TitleHits";
import {
  EMPTY_DRAFT,
  changesFromMatch,
  draftFromExtraction,
  entryFromDraft,
  mediaFromCatalog,
  peopleFromMatch,
  titleAfterPick,
  withoutMatchPeople,
  type EntryDraft,
} from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import CropDialog from "@/components/CropDialog";
import { convertImage, PHOTO_PRESET, STUB_PRESET } from "@/lib/images/convert";
import { takePrefill } from "@/lib/logPrefill";
import { withCoverage } from "@/lib/logShow";
import type { CatalogDetails, CatalogHit } from "@/lib/ports/catalog";
import { savePeople, syncCredits } from "@/lib/credits";
import { services } from "@/lib/services";
import { forgetEntry, recallEntry, rememberEntry } from "@/lib/entryMemory";

const SEARCH_DELAY_MS = 500;
const THUMB = "block h-14 w-14 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800";
const PLUS = "flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-xl text-white dark:bg-white dark:text-neutral-950";

export default function ScanPage() {
  const ready = useRequireSession();
  const router = useRouter();
  // What was typed before leaving the page comes back with it; saving or Clear all empties it.
  const [kept] = useState(recallEntry);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>(kept?.photos ?? []);
  const [cropPhoto, setCropPhoto] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>(kept?.images ?? []);
  const [errors, setErrors] = useState<FileProcessingError[]>([]);
  const [poster, setPoster] = useState<CoverChoice>(kept?.poster ?? null);
  const [backdrop, setBackdrop] = useState<CoverChoice>(kept?.backdrop ?? null);
  const [tmdbPictures, setTmdbPictures] = useState<{ tmdbId: number; posters: string[]; backdrops: string[] } | null>(null);

  const [draft, setDraft] = useState<EntryDraft>(kept?.draft ?? EMPTY_DRAFT);
  const [match, setMatch] = useState<CatalogDetails | null>(kept?.match ?? null);
  const [hits, setHits] = useState<CatalogHit[]>([]);
  /** What the blocking overlay says while something loads; null when the page is free to use. */
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ kind: "ticket" | "photo"; start: number } | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "rescan" | null>(null);

  // Written on every change so coming back finds the form as it was left.
  useEffect(() => {
    rememberEntry({ draft, match, poster, backdrop, images, photos });
  }, [draft, match, poster, backdrop, images, photos]);

  // Bumped by Clear all so the form's own boxes (venue suggestions and so on) start over too.
  const [formKey, setFormKey] = useState(0);
  const [clearFlash, setClearFlash] = useState(false);
  function clearAll() {
    forgetEntry();
    setDraft(EMPTY_DRAFT);
    setMatch(null);
    setHits([]);
    setPoster(null);
    setBackdrop(null);
    setImages([]);
    setPhotos([]);
    setErrors([]);
    setTmdbPictures(null);
    setProblem(null);
    setFormKey((k) => k + 1);
    // Shows black for a moment so the press is felt.
    setClearFlash(true);
    setTimeout(() => setClearFlash(false), 260);
  }

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRound = useRef(0);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  /** Picks the closest TMDB title for what the AI read, with no list to choose from. */
  async function autoMatch(title: string, category: EntryDraft["category"]) {
    const found = await services.catalog.findClosest(title, category);
    if (!found.ok) return setProblem(found.error);
    if (!found.value) return;
    const details = await services.catalog.details(found.value);
    if (details.ok) adopt(details.value);
    else setProblem(details.error);
  }

  /** Makes a TMDB title the match and fills the cast and crew rows from it. */
  function adopt(details: CatalogDetails) {
    setMatch(details);
    setDraft((current) => ({ ...current, people: peopleFromMatch(current.people, details) }));
  }

  /** The user changed the title or type: look for TMDB titles to offer. The link and the people stay as they are until another title is picked or the chip is removed. */
  function onUserEdit(_field: "title" | "category", next: EntryDraft) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const round = ++searchRound.current;

    searchTimer.current = setTimeout(async () => {
      const res = await services.catalog.search(next.title, next.category);
      // A slower, older search must not overwrite a newer one.
      if (round === searchRound.current) setHits(res.ok ? res.value : []);
    }, SEARCH_DELAY_MS);
  }

  async function pick(hit: CatalogHit) {
    setHits([]);
    setBusy("Finding on TMDB…");
    const details = await services.catalog.details(hit);
    setBusy(null);
    if (!details.ok) return setProblem(details.error);
    setMatch(details.value);
    setDraft((current) => ({ ...current, title: titleAfterPick(current.title, details.value.title), category: hit.kind, people: peopleFromMatch(current.people, details.value) }));
  }

  // Whenever a TMDB title is matched, offer its posters and covers.
  const matchId = match?.tmdbId ?? null;
  const matchKind = match && (match.category === "Movie" || match.category === "TV Show") ? match.category : null;
  useEffect(() => {
    if (matchId === null || !matchKind) return;
    let cancelled = false;
    services.catalog.images({ kind: matchKind, tmdbId: matchId }).then((res) => {
      if (cancelled) return;
      setTmdbPictures(res.ok ? { tmdbId: matchId, ...res.value } : null);
      setPoster((c) => (c?.kind === "tmdb" ? null : c));
      setBackdrop((c) => (c?.kind === "tmdb" ? null : c));
    });
    return () => {
      cancelled = true;
    };
  }, [matchId, matchKind]);

  // Reads the tickets: the text off the pictures, then the AI's reading of it. Only a first upload or Rescan does this, so nothing is asked twice by accident.
  const scanRound = useRef(0);
  async function scanTickets(from: string[], rescan = false) {
    if (from.length === 0) return;
    const round = ++scanRound.current;
    setBusy("Reading ticket…");
    setProblem(null);
    try {
      const texts = await OcrClient.extractTextFromImages(from);
      const combined = texts.filter(Boolean).join("\n--- PAGE BREAK ---\n");
      if (round !== scanRound.current) return;
      if (!combined.trim()) {
        setProblem("Could not detect any readable text. Fill in the fields by hand.");
        return;
      }

      setBusy("Asking AI…");
      const result = await services.ai.extractTicket(combined, rescan);
      if (round !== scanRound.current) return;
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      // The ticket's details replace the form's; people added by hand, the rating and the notes are kept.
      setDraft((current) => ({ ...draftFromExtraction(result.value), people: rescan ? withoutMatchPeople(current.people) : current.people, rating: current.rating, notes: current.notes }));
      if (rescan) {
        setMatch(null);
        setTmdbPictures(null);
      }
      const name = result.value.tmdbTitle ?? result.value.title;
      if (name) {
        setBusy("Finding on TMDB…");
        await autoMatch(name, result.value.category ?? "Movie");
      }
    } catch (err) {
      if (round === scanRound.current) setProblem(err instanceof Error ? err.message : "Failed processing ticket images.");
    } finally {
      if (round === scanRound.current) setBusy(null);
    }
  }

  // "Log another viewing" from a title page arrives here with the title already chosen.
  useEffect(() => {
    if (!ready) return;
    const prefill = takePrefill();
    if (!prefill) return;

    (async () => {
      // A title chosen from its page starts a new entry, replacing anything left from before.
      forgetEntry();
      setPoster(null);
      setBackdrop(null);
      setImages([]);
      setPhotos([]);
      setDraft((current) => ({
        ...EMPTY_DRAFT,
        category: prefill.category,
        title: prefill.title,
        season: prefill.season != null ? String(prefill.season) : current.season,
        episode: prefill.episode != null ? String(prefill.episode) : current.episode,
      }));
      setMatch(null);
      if (prefill.tmdbId === null || (prefill.category !== "Movie" && prefill.category !== "TV Show")) return;
      setBusy("Finding on TMDB…");
      const details = await services.catalog.details({ tmdbId: prefill.tmdbId, kind: prefill.category });
      if (details.ok) adopt(details.value);
      else setProblem(details.error);
      setBusy(null);
    })();
  }, [ready]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const entry = entryFromDraft(draft, match ? mediaFromCatalog(match) : null);
    if (!entry.ok) {
      setProblem(entry.error);
      return;
    }

    try {
      setBusy("Preparing images…");
      const stubs = await Promise.all(images.map((src) => convertImage(src, STUB_PRESET)));
      setBusy("Saving…");
      const saved = await services.log.saveEntry(await withCoverage(entry.value), stubs);
      if (!saved.ok) {
        setProblem(saved.error);
        setBusy(null);
        return;
      }
      if (saved.value.clearedWatchlist) toast("Removed from watchlist");
      // Chosen posters and covers are applied to the title; a custom upload replaces any earlier one.
      for (const [choice, kind] of [[poster, "poster"], [backdrop, "backdrop"]] as const) {
        if (choice?.kind === "tmdb") await services.images.useTmdbCover(saved.value.mediaId, kind, choice.path);
        else if (choice?.kind === "upload") {
          const added = await services.images.add({ mediaId: saved.value.mediaId }, kind, choice.blob, null);
          if (added.ok) await services.images.setDefault({ mediaId: saved.value.mediaId }, added.value.id);
        }
      }
      // People added by hand, and anyone taken out of a row, are applied before the usual credits refresh.
      const changes = changesFromMatch(draft.people, match, draft.category);
      if (changes.added.length > 0 || changes.removed.length > 0) await savePeople(saved.value.mediaId, changes.added, changes.removed);
      for (const photo of photos) await services.images.add({ sessionId: saved.value.sessionId }, "photo", photo.blob, null);
      // Genres and the rest of the cast and crew are saved last; the log entry itself is already safe.
      const tmdbId = entry.value.media?.tmdbId;
      if (tmdbId && (entry.value.category === "Movie" || entry.value.category === "TV Show")) {
        await syncCredits(saved.value.mediaId, entry.value.category, tmdbId);
      }
      forgetEntry();
      router.replace("/watchlist/");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save.");
      setBusy(null);
    }
  }

  if (!ready) return null;

  const canSearch = draft.category === "Movie" || draft.category === "TV Show";
  const pictures = tmdbPictures && tmdbPictures.tmdbId === matchId ? tmdbPictures : null;

  const suggestions = <TitleHits hits={hits} onPick={pick} />;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-6">
      <LoadingOverlay active={busy !== null} hiddenAtStart />

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl tracking-tight">New entry</h1>
      <button type="button" onClick={clearAll}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${clearFlash ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        Clear all
      </button>
      </div>
      <UploadToImages
        id="stub-upload"
        onUpload={(imgs, errs) => {
          setErrors(errs);
          if (imgs.length === 0) return;
          // The first tickets are read straight away; ones added later wait for Rescan tickets.
          const next = [...images, ...imgs];
          setImages(next);
          if (images.length === 0) void scanTickets(next);
        }}
      />

      {errors.map((err, index) => (
        <p key={index} className="text-sm text-red-600">{err.fileName}: {err.reason}</p>
      ))}
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />


      <form onSubmit={onSave} className="flex flex-col gap-5">
        <EntryForm
          key={formKey}
          showTmdbId={draft.category === "TV Show" ? matchId : null}
          draft={draft}
          onChange={setDraft}
          onUserEdit={onUserEdit}
          titleExtra={suggestions}
          link={match ? { tmdbId: match.tmdbId, label: `${match.title}${match.releaseDate ? ` · ${match.releaseDate.slice(0, 4)}` : ""}`, onClear: () => { setMatch(null); setTmdbPictures(null); setDraft((cur) => ({ ...cur, people: withoutMatchPeople(cur.people) })); } } : null}
          typeAction={<RoundButton icon="stubUpload" label="Upload ticket stubs" tone="dark" size="lg" onClick={() => document.getElementById("stub-upload")?.click()} />}
          disabled={busy !== null}
        />

        {!match && canSearch && draft.title.trim() && hits.length === 0 && (
          <p className="px-1 text-xs text-neutral-500">Pick a title from the list to use TMDB posters. Otherwise it is saved as a custom title.</p>
        )}

        <PosterChooser title="Poster" shape="poster" paths={pictures?.posters ?? []} defaultPath={match?.posterPath ?? null} choice={poster} onChoose={setPoster} />
        <PosterChooser title="Cover" shape="backdrop" paths={pictures?.backdrops ?? []} defaultPath={match?.backdropPath ?? null} choice={backdrop} onChoose={setBackdrop} />

        {/* Photos and ticket stubs sit as small circles, as on a saved viewing's edit page; tapping one opens it, and it can be removed there. */}
        <input id="photo-upload" type="file" accept="image/*" hidden onChange={(e) => { setCropPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs text-neutral-500">Photos</h2>
          <ul className="flex flex-wrap gap-2">
            {photos.map((photo, i) => (
              <li key={photo.url}>
                <button type="button" className={THUMB} aria-label={`Photo ${i + 1}`} onClick={() => setViewer({ kind: "photo", start: i })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
            <li><button type="button" className={PLUS} aria-label="Add to photos" onClick={() => document.getElementById("photo-upload")?.click()}>+</button></li>
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs text-neutral-500">Ticket stubs</h2>
          <ul className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <li key={src}>
                <button type="button" className={THUMB} aria-label={`Ticket ${i + 1}`} onClick={() => setViewer({ kind: "ticket", start: i })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
            <li><button type="button" className={PLUS} aria-label="Add to ticket stubs" onClick={() => document.getElementById("stub-upload")?.click()}>+</button></li>
          </ul>
        </section>
        {cropPhoto && (
          <CropDialog file={cropPhoto} aspect={1} maxEdge={PHOTO_PRESET.maxEdge} title="Frame your photo" onCancel={() => setCropPhoto(null)}
            onDone={(blob) => { setCropPhoto(null); setPhotos((list) => [...list, { blob, url: URL.createObjectURL(blob) }]); }} />
        )}

        {images.length > 0 && <RescanButton shape="full" disabled={busy !== null} onClick={() => setConfirm("rescan")} />}
        <button type="submit" disabled={busy !== null}
          className="rounded-full bg-neutral-950 px-5 py-4 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950">
          Save
        </button>
        <CancelButton shape="full" disabled={busy !== null} onClick={() => setConfirm("cancel")} />
      </form>

      {confirm === "cancel" && (
        <ConfirmPopup title="Discard this entry?" message="Everything you've entered here will be cleared." confirmLabel="Discard" confirmIcon="trash"
          onConfirm={() => { setConfirm(null); clearAll(); router.push("/home/"); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === "rescan" && (
        <ConfirmPopup title="Rescan your tickets?" message="What your tickets say will replace the details filled in above." confirmLabel="Rescan" confirmIcon="refresh"
          onConfirm={() => { setConfirm(null); void scanTickets(images, true); }} onCancel={() => setConfirm(null)} />
      )}
      {viewer && (viewer.kind === "ticket" ? images.length > 0 : photos.length > 0) && (
        <ImageViewer
          images={viewer.kind === "ticket" ? images.map((url) => ({ url, local: true })) : photos.map((p) => ({ url: p.url, local: true }))}
          start={viewer.start}
          onClose={() => setViewer(null)}
          onAdd={() => document.getElementById(viewer.kind === "ticket" ? "stub-upload" : "photo-upload")?.click()}
          onDelete={(image) => {
            if (viewer.kind === "ticket") setImages((list) => list.filter((u) => u !== image.url));
            else setPhotos((list) => list.filter((p) => p.url !== image.url));
          }}
        />
      )}
    </main>
  );
}
