// app/profile/data/page.tsx
// Moving a history in or out of other apps: Letterboxd and Trakt files. Backups are on Profile.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useRef, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { exportLetterboxd, exportTrakt } from "@/lib/backup";
import { downloadBlob } from "@/lib/ics";
import { importCsv } from "@/lib/importCsv";
import type { Result } from "@/lib/ports/result";

const button = "rounded-2xl border border-neutral-300 px-4 py-3 text-left text-sm disabled:opacity-40 dark:border-neutral-700";

export default function DataPage() {
  const ready = useRequireSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  async function run(name: string, task: () => Promise<Result<Blob>>) {
    setBusy(true);
    setProblem(null);
    setMessage("Preparing…");
    const res = await task();
    if (res.ok) {
      downloadBlob(name, res.value);
      setMessage("Done. Your file was downloaded.");
    } else {
      setProblem(res.error);
      setMessage(null);
    }
    setBusy(false);
  }

  async function bringIn(file: File) {
    setBusy(true);
    setProblem(null);
    const res = await importCsv(file, (done, total) => setMessage(`Matching titles (${done} of ${total})…`));
    if (res.ok) setMessage(`Added ${res.value.saved} viewings${res.value.skipped ? `; ${res.value.skipped} could not be matched` : ""}.`);
    else {
      setProblem(res.error);
      setMessage(null);
    }
    setBusy(false);
  }

  if (!ready) return null;
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Import and export</h1>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {message && <p role="status" className="text-sm">{message}</p>}

      <div className="flex flex-col gap-3">
        <button type="button" disabled={busy} className={button} onClick={() => run(`filme-letterboxd-${stamp}.csv`, exportLetterboxd)}>
          <span className="block font-medium">Letterboxd file (CSV)</span>
          <span className="text-neutral-500">Movies, dates and ratings, ready to import there.</span>
        </button>
        <button type="button" disabled={busy} className={button} onClick={() => run(`filme-trakt-${stamp}.csv`, exportTrakt)}>
          <span className="block font-medium">Trakt-style history (CSV)</span>
          <span className="text-neutral-500">Movies and episodes with TMDB ids.</span>
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl">Bring in a history</h2>
        <p className="text-sm text-neutral-500">Choose a Letterboxd diary or a Trakt history CSV. Titles are matched on TMDB by name and year; up to 400 rows at a time.</p>
        <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void bringIn(f); }} />
        <button type="button" disabled={busy} className={button} onClick={() => csvInput.current?.click()}>Choose a CSV file</button>
      </section>
    </main>
  );
}
