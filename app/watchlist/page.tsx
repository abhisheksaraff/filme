// app/watchlist/page.tsx
// Entry point for logging a viewing, with the most recent ones listed below.
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FileProcessingError } from "@/components/UploadToImages";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { RecentEntry } from "@/lib/ports/log";
import { services } from "@/lib/services";

const UploadToImages = dynamic(() => import("@/components/UploadToImages"), {
  ssr: false,
});

export default function WatchlistPage() {
  const ready = useRequireSession();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.log.recent(20).then((res) => {
      if (cancelled) return;
      if (res.ok) setRecent(res.value);
      else setProblem(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const handleUpload = (images: string[], errors: FileProcessingError[]) => {
    // Save images and errors (if present) so /scan can handle them
    if (images.length > 0) {
      sessionStorage.setItem("scanned_ticket_images", JSON.stringify(images));
    } else {
      sessionStorage.removeItem("scanned_ticket_images");
    }

    if (errors.length > 0) {
      sessionStorage.setItem("scanned_ticket_errors", JSON.stringify(errors));
    } else {
      sessionStorage.removeItem("scanned_ticket_errors");
    }

    if (images.length > 0 || errors.length > 0) {
      router.push("/scan/");
    }
  };

  const handleManualInput = () => {
    sessionStorage.removeItem("scanned_ticket_images");
    sessionStorage.removeItem("scanned_ticket_errors");
    router.push("/scan/");
  };

  if (!ready) return null;

  const button = "rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tight">Log</h1>
        <Link href="/profile/keys/" className="text-sm text-neutral-500">API keys</Link>
      </div>

      <div className="flex gap-2">
        <button type="button" className={button} onClick={() => document.getElementById("file-upload")?.click()}>
          Upload
        </button>
        <button type="button" className={button} onClick={handleManualInput}>
          Manual Input
        </button>
      </div>

      <UploadToImages id="file-upload" onUpload={handleUpload} />

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <ul className="flex flex-col gap-3">
        {recent.map((entry) => {
          const poster = tmdbImageUrl(entry.posterPath, "w185");
          return (
            <li key={entry.id} className="flex gap-3">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="w-16 rounded-lg" />
              ) : (
                <div className="h-24 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
              )}
              <div className="flex flex-col justify-center text-sm">
                <span className="font-medium">{entry.title}</span>
                <span className="text-neutral-500">
                  {[entry.watchedOn, entry.primaryFormat].filter(Boolean).join(" · ")}
                </span>
              </div>
            </li>
          );
        })}
        {recent.length === 0 && !problem && <li className="text-sm text-neutral-500">Nothing logged yet.</li>}
      </ul>
    </main>
  );
}
