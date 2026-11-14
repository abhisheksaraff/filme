// app/scan/page

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { FileProcessingError } from "@/components/UploadToImages";
import { OcrClient } from "@/lib/ocrClient";
import { DEFAULT_EXTRACTED_DATA, type ExtractedData } from "@/lib/domain/extraction";
import type { CatalogDetails } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

type AiOutcome = { success: boolean; data: ExtractedData; error?: string };
type TmdbDetails = CatalogDetails;

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
  const images = useSyncExternalStore(
    subscribe,
    getImagesSnapshot,
    getServerImagesSnapshot
  );

  const errors = useSyncExternalStore(
    subscribe,
    getErrorsSnapshot,
    getServerErrorsSnapshot
  );

  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<AiOutcome | null>(null);
  const [tmdbMatch, setTmdbMatch] = useState<TmdbDetails | null>(null);
  const [hasSearchedTmdb, setHasSearchedTmdb] = useState<boolean>(false);
  const [isTmdbLoading, setIsTmdbLoading] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (images.length === 0) return;

    let isMounted = true;

    Promise.resolve().then(() => {
      if (isMounted) {
        setIsProcessing(true);
        setProcessingError(null);
        setTmdbMatch(null);
        setHasSearchedTmdb(false);
      }
    });

    OcrClient.extractTextFromImages(images)
      .then((texts) => {
        if (!isMounted) return;
        setExtractedTexts(texts);
        const combined = texts.filter(Boolean).join("\n--- PAGE BREAK ---\n");
        if (!combined.trim()) {
          return { success: false, data: DEFAULT_EXTRACTED_DATA, error: "Could not detect any readable text from the ticket image(s)." } as AiOutcome;
        }
        return services.ai.extractTicket(combined).then(
          (r): AiOutcome => (r.ok ? { success: true, data: r.value } : { success: false, data: DEFAULT_EXTRACTED_DATA, error: r.error }),
        );
      })
      .then(async (result) => {
        if (!isMounted || !result) return;
        setAiResult(result);

        if (!result.success && result.error) {
          setProcessingError(result.error);
          setIsProcessing(false);
          return;
        }

        // Fetch Closest Match ONLY if AI succeeds and title exists
        if (result.success && result.data?.title) {
          setIsTmdbLoading(true);
          try {
            const found = await services.catalog.findClosest(result.data.title, result.data.category);
            if (isMounted) {
              setHasSearchedTmdb(true);
              if (found.ok && found.value) {
                const details = await services.catalog.details(found.value);
                if (isMounted && details.ok) setTmdbMatch(details.value);
              }
            }
          } catch (tmdbErr) {
            console.error("TMDB fetch failed:", tmdbErr);
          } finally {
            if (isMounted) setIsTmdbLoading(false);
          }
        }

        setIsProcessing(false);
      })
      .catch((err) => {
        if (isMounted) {
          setProcessingError(
            err instanceof Error ? err.message : "Failed processing ticket images."
          );
          setIsProcessing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [images]);

  const isUpload = images.length > 0 || errors.length > 0;
  const activeTexts = images.length === 0 ? [] : extractedTexts;
  const activeAiResult = images.length === 0 ? null : aiResult;

  return (
    <main>
      <h2>{isUpload ? "Upload" : "Manual"}</h2>

      {errors.length > 0 && (
        <div>
          {errors.map((err, index) => (
            <p key={index}>
              Error processing {err.fileName} ({err.fileType}): {err.reason}
            </p>
          ))}
        </div>
      )}

      {processingError && <p>Error: {processingError}</p>}

      {images.map((src, index) => (
        <div key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Scanned Ticket Stub ${index + 1}`} />
        </div>
      ))}

      {isProcessing && images.length > 0 && activeTexts.length === 0 && (
        <p>Extracting text from images...</p>
      )}

      {activeTexts.length > 0 && (
        <div>
          {activeTexts.map((text, index) => (
            <div key={index}>
              <p>Image {index + 1} Extracted Text:</p>
              <pre>{text || "[No text detected]"}</pre>
            </div>
          ))}
        </div>
      )}

      {isProcessing && activeTexts.length > 0 && !activeAiResult && (
        <p>Parsing session data with AI Client...</p>
      )}

      {activeAiResult && (
        <div>
          <h3>AI Extracted Watch Session Data:</h3>
          <pre>{JSON.stringify(activeAiResult.data, null, 2)}</pre>
        </div>
      )}

      {isTmdbLoading && <p>Searching TMDB for closest match...</p>}

      {tmdbMatch && (
        <div>
          <h3>Closest TMDB Match Result:</h3>
          {tmdbMatch.posterUrl && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tmdbMatch.posterUrl}
                alt={tmdbMatch.title || "Poster"}
              />
            </div>
          )}
          <pre>{JSON.stringify(tmdbMatch, null, 2)}</pre>
        </div>
      )}

      {hasSearchedTmdb && !isTmdbLoading && !tmdbMatch && (
        <p>No matching movie or TV show found on TMDB.</p>
      )}
    </main>
  );
}