// app/profile/data/page.tsx
// Backups and moving data in or out: a full ZIP, JSON only, Letterboxd and Trakt files, and restore.
"use client";

import { useEffect, useRef, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { exportJson, exportLetterboxd, exportTrakt, exportZip, importBackup } from "@/lib/backup";
import { downloadBlob } from "@/lib/ics";
import { importCsv } from "@/lib/importCsv";
import type { Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const button = "rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm disabled:opacity-40 dark:border-neutral-700";

export default function DataPage() {
  const ready = useRequireSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.settings.lastBackup().then((res) => {
      if (!cancelled && res.ok) setLast(res.value);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function run(name: string, task: () => Promise<Result<Blob>>) {
    setBusy(true);
    setProblem(null);
    setMessage("Preparing…");
    const res = await task();
    if (res.ok) {
      downloadBlob(name, res.value);
      setMessage("Done. Your file was downloaded.");
      setLast(new Date().toISOString());
    } else {
      setProblem(res.error);
      setMessage(null);
    }
    setBusy(false);
  }

  async function restore(file: File) {
    setBusy(true);
    setProblem(null);
    const res = await importBackup(file, setMessage);
    if (res.ok) setMessage(res.value);
    else {
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
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-12 pt-8">
      <BackLink fallback="/profile/" />
      <h1 className="font-serif text-3xl tracking-tight">Your data</h1>
      <p className="text-sm text-neutral-500">{last ? `Last backup: ${last.slice(0, 10)}.` : "You have not made a backup yet."}</p>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}

      <div className="flex flex-col gap-3">
        <button type="button" disabled={busy} className={button} onClick={() => run(`filme-backup-${stamp}.zip`, () => exportZip((d, t) => setMessage(`Collecting pictures (${d} of ${t})…`)))}>
          <span className="block font-medium">Full backup (ZIP)</span>
          <span className="text-neutral-500">Everything, including ticket stubs and photos.</span>
        </button>
        <button type="button" disabled={busy} className={button} onClick={() => run(`filme-data-${stamp}.json`, exportJson)}>
          <span className="block font-medium">Data only (JSON)</span>
          <span className="text-neutral-500">Small and quick; no pictures.</span>
        </button>
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
        <h2 className="font-serif text-xl">Restore</h2>
        <p className="text-sm text-neutral-500">Choose a backup made here (ZIP or JSON). Anything already in your log is updated, not duplicated.</p>
        <input ref={input} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void restore(f); }} />
        <button type="button" disabled={busy} className={button} onClick={() => input.current?.click()}>Choose a backup file</button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl">Bring in a history</h2>
        <p className="text-sm text-neutral-500">Choose a Letterboxd diary or a Trakt history CSV. Titles are matched on TMDB by name and year; up to 400 rows at a time.</p>
        <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void bringIn(f); }} />
        <button type="button" disabled={busy} className={button} onClick={() => csvInput.current?.click()}>Choose a CSV file</button>
      </section>
    </main>
  );
}
