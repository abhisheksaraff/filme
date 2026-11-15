// components/DataSync.tsx
// Four round buttons at the bottom of Profile: download or upload your data, and your images.
// Uploading syncs: it adds what is missing and never replaces something newer with something older.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { downloadData, downloadImages, uploadData, uploadImages } from "@/lib/backup";
import { downloadBlob } from "@/lib/ics";

type Job = "download-data" | "upload-data" | "download-images" | "upload-images";

const RING = 2 * Math.PI * 26;

interface ButtonProps {
  label: string;
  icon: IconName;
  /** Small arrow in the corner: down for download, up for upload. */
  arrow: "down" | "up";
  working: boolean;
  /** 0 to 1 while running; null when the length is not known. */
  progress: number | null;
  disabled: boolean;
  onClick: () => void;
}

function SyncButton({ label, icon, arrow, working, progress, disabled, onClick }: ButtonProps) {
  return (
    <li className="flex w-20 flex-col items-center gap-1.5">
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">
        <Icon name={icon} size={22} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-500 text-white ring-2 ring-white dark:ring-neutral-950">
          <Icon name={arrow === "down" ? "sortOld" : "sortNew"} size={12} />
        </span>
        {working && (
          <svg className={`pointer-events-none absolute -inset-1 h-16 w-16 -rotate-90 ${progress === null ? "animate-spin" : ""}`} viewBox="0 0 60 60" aria-hidden>
            <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="3" className="text-neutral-300 dark:text-neutral-700" />
            <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-neutral-950 dark:text-white"
              strokeDasharray={RING} strokeDashoffset={RING * (1 - (progress ?? 0.25))} />
          </svg>
        )}
      </button>
      <span className="text-center text-[11px] leading-tight text-neutral-600 dark:text-neutral-400">{label}</span>
    </li>
  );
}

export default function DataSync() {
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dataInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const stamp = () => new Date().toISOString().slice(0, 10);

  async function run(name: Job, task: () => Promise<string | null>) {
    setJob(name);
    setProgress(null);
    setProblem(null);
    setMessage(null);
    const failure = await task().catch(() => "Something went wrong. Try again.");
    // A task returns an error message, or null when it set its own success message.
    if (failure) setProblem(failure);
    setJob(null);
    setProgress(null);
  }

  const saveData = () =>
    run("download-data", async () => {
      const res = await downloadData();
      if (!res.ok) return res.error;
      downloadBlob(`filme-data-${stamp()}.json`, res.value);
      setMessage("Your data file was downloaded.");
      return null;
    });

  const saveImages = () =>
    run("download-images", async () => {
      const res = await downloadImages((done, total) => setProgress(total === 0 ? 1 : done / total));
      if (!res.ok) return res.error;
      const { parts, missing } = res.value;
      if (parts.length === 0) {
        setMessage("There are no uploaded images to download yet.");
        return null;
      }
      parts.forEach((part, i) => downloadBlob(`filme-images-${stamp()}${parts.length > 1 ? `-part${i + 1}` : ""}.zip`, part));
      setMessage(`Downloaded ${parts.length} image ${parts.length === 1 ? "file" : "files"}${missing ? `; ${missing} could not be read` : ""}.`);
      return null;
    });

  const sendData = (file: File) =>
    run("upload-data", async () => {
      const res = await uploadData(file);
      if (!res.ok) return res.error;
      setMessage(res.value);
      return null;
    });

  const sendImages = (files: File[]) =>
    run("upload-images", async () => {
      const res = await uploadImages(files, (done, total) => setProgress(total === 0 ? 1 : done / total));
      if (!res.ok) return res.error;
      setMessage(res.value);
      return null;
    });

  const busy = job !== null;
  const props = (name: Job) => ({ working: job === name, progress, disabled: busy });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-xl">Your data</h2>
      <input ref={dataInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendData(f); }} />
      <input ref={imageInput} type="file" accept=".zip,application/zip" multiple hidden onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length > 0) void sendImages(f); }} />
      <ul className="flex justify-between">
        <SyncButton label="Download data" icon="database" arrow="down" onClick={saveData} {...props("download-data")} />
        <SyncButton label="Upload data" icon="database" arrow="up" onClick={() => dataInput.current?.click()} {...props("upload-data")} />
        <SyncButton label="Download images" icon="image" arrow="down" onClick={saveImages} {...props("download-images")} />
        <SyncButton label="Upload images" icon="image" arrow="up" onClick={() => imageInput.current?.click()} {...props("upload-images")} />
      </ul>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {message && <p role="status" className="text-sm">{message}</p>}
      <p className="text-xs text-neutral-500">Uploading adds what is missing and keeps the newer copy of anything in both. On a new account, upload your data before your images.</p>
    </section>
  );
}
