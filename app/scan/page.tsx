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
import {
  EMPTY_DRAFT,
  changesFromMatch,
  draftFromExtraction,
  entryFromDraft,
  mediaFromCatalog,
  peopleFromMatch,
  withoutMatchPeople,
  type EntryDraft,
} from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import CropDialog from "@/components/CropDialog";
import Icon from "@/components/Icon";
import { convertImage, PHOTO_PRESET, STUB_PRESET } from "@/lib/images/convert";
import { takePrefill } from "@/lib/logPrefill";
import { withCoverage } from "@/lib/logShow";
import type { CatalogDetails, CatalogHit } from "@/lib/ports/catalog";
import { savePeople, syncCredits } from "@/lib/credits";
import { services } from "@/lib/services";
import SuggestionList, { SUGGESTION_NOTE, SuggestionItem } from "@/components/ui/SuggestionList";
import { forgetEntry, recallEntry, rememberEntry } from "@/lib/entryMemory";

const SEARCH_DELAY_MS = 500;

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

  /** The user changed the title or type: drop the old match and search again after a short pause. */
  function onUserEdit(_field: "title" | "category", next: EntryDraft) {
    setMatch(null);
    // The old match's people no longer apply; anyone added by hand stays.
    setDraft((current) => ({ ...current, people: withoutMatchPeople(current.people) }));
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
    setDraft((current) => ({ ...current, title: details.value.title, category: hit.kind, people: peopleFromMatch(current.people, details.value) }));
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

  useEffect(() => {
    if (!ready || images.length === 0) return;
    let cancelled = false;

    (async () => {
      setBusy("Reading ticket…");
      setProblem(null);
      try {
        const texts = await OcrClient.extractTextFromImages(images);
        const combined = texts.filter(Boolean).join("\n--- PAGE BREAK ---\n");
        if (cancelled) return;
        if (!combined.trim()) {
          setProblem("Could not detect any readable text. Fill in the fields by hand.");
          return;
        }

        setBusy("Asking AI…");
        const result = await services.ai.extractTicket(combined);
        if (cancelled) return;
        if (!result.ok) {
          setProblem(result.error);
          return;
        }
        setDraft(draftFromExtraction(result.value));

        if (result.value.title) {
          setBusy("Finding on TMDB…");
          await autoMatch(result.value.title, result.value.category ?? "Movie");
        }
      } catch (err) {
        if (!cancelled) setProblem(err instanceof Error ? err.message : "Failed processing ticket images.");
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // autoMatch and adopt only use state setters and services, so they are safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, images]);

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

  const suggestions =
    hits.length > 0 ? (
      <SuggestionList>
        {hits.map((hit) => (
          <SuggestionItem key={`${hit.kind}-${hit.tmdbId}`}>
            <button type="button" onClick={() => pick(hit)} className="flex w-full items-center gap-3 p-2 text-left">
              {hit.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hit.posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-10 rounded-lg bg-neutral-300 dark:bg-neutral-600" />
              )}
              <span className="flex flex-col text-sm">
                <span className="font-medium">{hit.title}</span>
                <span className={SUGGESTION_NOTE}>{[hit.year, hit.kind].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          </SuggestionItem>
        ))}
      </SuggestionList>
    ) : null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-6">
      <LoadingOverlay active={busy !== null} hiddenAtStart />

      <button type="button" onClick={clearAll}
        className={`self-start rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${clearFlash ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        Clear all
      </button>
      <h1 className="font-serif text-3xl tracking-tight">New entry</h1>
      <UploadToImages
        id="stub-upload"
        onUpload={(imgs, errs) => {
          setImages(imgs);
          setErrors(errs);
        }}
      />

      {errors.map((err, index) => (
        <p key={index} className="text-sm text-red-600">{err.fileName}: {err.reason}</p>
      ))}
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {images.length > 0 && (
        <ul className="-mx-6 flex gap-2 overflow-x-auto px-6">
          {images.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={index} className="shrink-0"><img src={src} alt={`Ticket ${index + 1}`} className="h-32 rounded-xl" /></li>
          ))}
        </ul>
      )}

      <form onSubmit={onSave} className="flex flex-col gap-5">
        <EntryForm
          key={formKey}
          showTmdbId={draft.category === "TV Show" ? matchId : null}
          draft={draft}
          onChange={setDraft}
          onUserEdit={onUserEdit}
          titleExtra={suggestions}
          typeAction={<RoundButton icon="stubUpload" label="Upload ticket stubs" tone="dark" size="lg" onClick={() => document.getElementById("stub-upload")?.click()} />}
          disabled={busy !== null}
        />

        {!match && canSearch && draft.title.trim() && hits.length === 0 && (
          <p className="px-1 text-xs text-neutral-500">Pick a title from the list to use TMDB posters. Otherwise it is saved as a custom title.</p>
        )}
        {match && (
          <div className="flex items-center justify-between rounded-full bg-neutral-100 py-2 pl-4 pr-2 text-sm dark:bg-neutral-800">
            <span className="font-medium">{match.title}{match.releaseDate ? ` · ${match.releaseDate.slice(0, 4)}` : ""}</span>
            <RoundButton icon="close" label="Clear TMDB match" size="sm" onClick={() => { setMatch(null); setTmdbPictures(null); }} />
          </div>
        )}

        <PosterChooser title="Poster" shape="poster" paths={pictures?.posters ?? []} defaultPath={match?.posterPath ?? null} choice={poster} onChoose={setPoster} />
        <PosterChooser title="Cover" shape="backdrop" paths={pictures?.backdrops ?? []} defaultPath={match?.backdropPath ?? null} choice={backdrop} onChoose={setBackdrop} />

        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Photos</h2>
          <input id="photo-upload" type="file" accept="image/*" hidden onChange={(e) => { setCropPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <ul className="flex flex-wrap items-center gap-2">
            {photos.map((photo) => (
              <li key={photo.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Your photo" className="h-12 w-12 rounded-full object-cover" />
              </li>
            ))}
            <li>
              <button type="button" aria-label="Add a photo" onClick={() => document.getElementById("photo-upload")?.click()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                <Icon name="plus" size={18} />
              </button>
            </li>
          </ul>
          {cropPhoto && (
            <CropDialog file={cropPhoto} aspect={1} maxEdge={PHOTO_PRESET.maxEdge} title="Frame your photo" onCancel={() => setCropPhoto(null)}
              onDone={(blob) => { setCropPhoto(null); setPhotos((list) => [...list, { blob, url: URL.createObjectURL(blob) }]); }} />
          )}
        </section>

        <button type="submit" disabled={busy !== null}
          className="rounded-full bg-neutral-950 px-5 py-4 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950">
          Save
        </button>
      </form>
    </main>
  );
}
