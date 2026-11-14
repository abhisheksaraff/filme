// app/scan/page.tsx
// Reads ticket images (or starts blank), lets the user correct the result, and saves the viewing.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { FileProcessingError } from "@/components/UploadToImages";
import { OcrClient } from "@/lib/ocrClient";
import EntryForm from "@/components/EntryForm";
import LoadingOverlay from "@/components/LoadingOverlay";
import {
  EMPTY_DRAFT,
  draftFromExtraction,
  entryFromDraft,
  mediaFromCatalog,
  type EntryDraft,
} from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { convertImage, STUB_PRESET } from "@/lib/images/convert";
import type { CatalogDetails, CatalogHit } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

// Image Cache
let cachedImagesRaw: string | null = null;
let cachedImages: string[] = [];

function getImagesSnapshot(): string[] {
  if (typeof window === "undefined") return cachedImages;

  const storedImages = sessionStorage.getItem("scanned_ticket_images");

  if (storedImages !== cachedImagesRaw) {
    cachedImagesRaw = storedImages;
    if (!storedImages) {
      cachedImages = [];
    } else {
      try {
        const parsed = JSON.parse(storedImages);
        cachedImages = Array.isArray(parsed) ? parsed : [];
      } catch {
        cachedImages = [];
      }
    }
  }

  return cachedImages;
}

// Error Cache
let cachedErrorsRaw: string | null = null;
let cachedErrors: FileProcessingError[] = [];

function getErrorsSnapshot(): FileProcessingError[] {
  if (typeof window === "undefined") return cachedErrors;

  const storedErrors = sessionStorage.getItem("scanned_ticket_errors");

  if (storedErrors !== cachedErrorsRaw) {
    cachedErrorsRaw = storedErrors;
    if (!storedErrors) {
      cachedErrors = [];
    } else {
      try {
        const parsed = JSON.parse(storedErrors);
        cachedErrors = Array.isArray(parsed) ? parsed : [];
      } catch {
        cachedErrors = [];
      }
    }
  }

  return cachedErrors;
}

const SERVER_SNAPSHOT_IMAGES: string[] = [];
function getServerImagesSnapshot(): string[] {
  return SERVER_SNAPSHOT_IMAGES;
}

const SERVER_SNAPSHOT_ERRORS: FileProcessingError[] = [];
function getServerErrorsSnapshot(): FileProcessingError[] {
  return SERVER_SNAPSHOT_ERRORS;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

const SEARCH_DELAY_MS = 500;

export default function ScanPage() {
  const ready = useRequireSession();
  const router = useRouter();
  const images = useSyncExternalStore(subscribe, getImagesSnapshot, getServerImagesSnapshot);
  const errors = useSyncExternalStore(subscribe, getErrorsSnapshot, getServerErrorsSnapshot);

  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT);
  const [match, setMatch] = useState<CatalogDetails | null>(null);
  const [hits, setHits] = useState<CatalogHit[]>([]);
  /** What the blocking overlay says while something loads; null when the page is free to use. */
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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
    if (details.ok) setMatch(details.value);
    else setProblem(details.error);
  }

  /** The user changed the title or type: drop the old match and search again after a short pause. */
  function onUserEdit(_field: "title" | "category", next: EntryDraft) {
    setMatch(null);
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
    setDraft((current) => ({ ...current, title: details.value.title, category: hit.kind }));
  }

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
    // autoMatch only uses setters and services, so it is safe to leave out.
  }, [ready, images]);

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
      const saved = await services.log.saveEntry(entry.value, stubs);
      if (!saved.ok) {
        setProblem(saved.error);
        setBusy(null);
        return;
      }
      sessionStorage.removeItem("scanned_ticket_images");
      sessionStorage.removeItem("scanned_ticket_errors");
      router.replace("/watchlist/");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save.");
      setBusy(null);
    }
  }

  if (!ready) return null;

  const isUpload = images.length > 0 || errors.length > 0;
  const canSearch = draft.category === "Movie" || draft.category === "TV Show";

  const suggestions =
    hits.length > 0 ? (
      <ul className="flex flex-col overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.tmdbId}`}>
            <button type="button" onClick={() => pick(hit)}
              className="flex w-full items-center gap-3 p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900">
              {hit.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hit.posterUrl} alt="" className="h-14 w-10 rounded object-cover" />
              ) : (
                <div className="h-14 w-10 rounded bg-neutral-200 dark:bg-neutral-800" />
              )}
              <span className="flex flex-col text-sm">
                <span className="font-medium">{hit.title}</span>
                <span className="text-neutral-500">{[hit.year, hit.kind].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      {busy && <LoadingOverlay label={busy} />}

      <Link href="/watchlist/" className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-3xl tracking-tight">{isUpload ? "Review ticket" : "New entry"}</h1>

      {errors.map((err, index) => (
        <p key={index} className="text-sm text-red-600">
          Error processing {err.fileName} ({err.fileType}): {err.reason}
        </p>
      ))}
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={src} alt={`Ticket ${index + 1}`} className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      {match && (
        <div className="overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700">
          {match.backdropUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.backdropUrl} alt="" className="h-36 w-full object-cover" />
          )}
          <div className="flex items-start gap-3 p-3">
            {match.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.posterUrl} alt={match.title} className="w-20 rounded-lg" />
            )}
            <div className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">{match.title}</span>
              <span className="text-neutral-500">{match.releaseDate?.slice(0, 4)}</span>
              {match.directors.length > 0 && <span>Directed by {match.directors.join(", ")}</span>}
            </div>
            <button type="button" aria-label="Clear TMDB match" onClick={() => setMatch(null)}>✕</button>
          </div>
        </div>
      )}
      {!match && canSearch && draft.title.trim() && hits.length === 0 && (
        <p className="text-sm text-neutral-500">No TMDB title picked, so this will be saved as a custom title.</p>
      )}

      <form onSubmit={onSave} className="flex flex-col gap-5">
        <EntryForm
          draft={draft}
          onChange={setDraft}
          onUserEdit={onUserEdit}
          titleExtra={suggestions}
          disabled={busy !== null}
        />
        <button type="submit" disabled={busy !== null}
          className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          Save viewing
        </button>
      </form>
    </main>
  );
}
