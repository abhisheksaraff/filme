// app/scan/page.tsx
// Reads ticket images (or starts blank), lets the user correct the result, and saves the viewing.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import type { FileProcessingError } from "@/components/UploadToImages";
import { OcrClient } from "@/lib/ocrClient";
import EntryForm from "@/components/EntryForm";
import {
  EMPTY_DRAFT,
  draftFromExtraction,
  entryFromDraft,
  mediaFromCatalog,
  type EntryDraft,
} from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { convertImage, STUB_PRESET } from "@/lib/images/convert";
import type { CatalogDetails } from "@/lib/ports/catalog";
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

export default function ScanPage() {
  const ready = useRequireSession();
  const router = useRouter();
  const images = useSyncExternalStore(subscribe, getImagesSnapshot, getServerImagesSnapshot);
  const errors = useSyncExternalStore(subscribe, getErrorsSnapshot, getServerErrorsSnapshot);

  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT);
  const [match, setMatch] = useState<CatalogDetails | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Finds the closest TMDB title and keeps it so its poster and details are saved too. */
  async function lookUp(title: string, category: EntryDraft["category"]) {
    if (!title.trim()) return;
    setStatus("Searching TMDB…");
    const found = await services.catalog.findClosest(title, category);
    if (!found.ok) {
      setProblem(found.error);
    } else if (!found.value) {
      setMatch(null);
      setStatus("No match on TMDB. It will be saved as a custom title.");
      return;
    } else {
      const details = await services.catalog.details(found.value);
      if (details.ok) {
        setMatch(details.value);
        setStatus(null);
        return;
      }
      setProblem(details.error);
    }
    setStatus(null);
  }

  useEffect(() => {
    if (!ready || images.length === 0) return;
    let cancelled = false;

    (async () => {
      setStatus("Reading the ticket…");
      setProblem(null);
      try {
        const texts = await OcrClient.extractTextFromImages(images);
        const combined = texts.filter(Boolean).join("\n--- PAGE BREAK ---\n");
        if (cancelled) return;
        if (!combined.trim()) {
          setProblem("Could not detect any readable text. Fill in the fields by hand.");
          setStatus(null);
          return;
        }

        setStatus("Asking the AI…");
        const result = await services.ai.extractTicket(combined);
        if (cancelled) return;
        if (!result.ok) {
          setProblem(result.error);
          setStatus(null);
          return;
        }
        setDraft(draftFromExtraction(result.value));
        if (result.value.title) await lookUp(result.value.title, result.value.category ?? "Movie");
        else setStatus(null);
      } catch (err) {
        if (!cancelled) {
          setProblem(err instanceof Error ? err.message : "Failed processing ticket images.");
          setStatus(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, images]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const entry = entryFromDraft(draft, match ? mediaFromCatalog(match) : null);
    if (!entry.ok) {
      setProblem(entry.error);
      return;
    }

    setSaving(true);
    try {
      setStatus("Preparing images…");
      const stubs = await Promise.all(images.map((src) => convertImage(src, STUB_PRESET)));
      setStatus("Saving…");
      const saved = await services.log.saveEntry(entry.value, stubs);
      if (!saved.ok) {
        setProblem(saved.error);
        setStatus(null);
        return;
      }
      sessionStorage.removeItem("scanned_ticket_images");
      sessionStorage.removeItem("scanned_ticket_errors");
      router.replace("/watchlist/");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save.");
      setStatus(null);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  const isUpload = images.length > 0 || errors.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <Link href="/watchlist/" className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-3xl tracking-tight">{isUpload ? "Review ticket" : "New entry"}</h1>

      {errors.map((err, index) => (
        <p key={index} className="text-sm text-red-600">
          Error processing {err.fileName} ({err.fileType}): {err.reason}
        </p>
      ))}
      {status && <p role="status" className="text-sm">{status}</p>}
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={src} alt={`Ticket ${index + 1}`} className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      <form onSubmit={onSave} className="flex flex-col gap-5">
        <EntryForm draft={draft} onChange={setDraft} disabled={saving} />

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
          <h2 className="font-serif text-xl">TMDB match</h2>
          {match ? (
            <>
              {match.backdropUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={match.backdropUrl} alt="" className="w-full rounded-lg" />
              )}
              <div className="flex gap-3">
                {match.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={match.posterUrl} alt={match.title} className="w-24 rounded-lg" />
                )}
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{match.title}</span>
                  <span className="text-neutral-500">{match.releaseDate?.slice(0, 4)}</span>
                  {match.directors.length > 0 && <span>Directed by {match.directors.join(", ")}</span>}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No title matched yet.</p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={saving || !draft.title.trim()}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-neutral-700"
              onClick={() => lookUp(draft.title, draft.category)}>
              {match ? "Search again" : "Look up on TMDB"}
            </button>
            {match && (
              <button type="button" disabled={saving}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
                onClick={() => setMatch(null)}>
                Clear match
              </button>
            )}
          </div>
        </section>

        <button type="submit" disabled={saving}
          className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {saving ? "Saving…" : "Save viewing"}
        </button>
      </form>
    </main>
  );
}
