// app/entry/page.tsx
// Edits one saved viewing. The title it belongs to stays as it is; change that by logging a new viewing.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import EntryForm from "@/components/EntryForm";
import LoadingOverlay from "@/components/LoadingOverlay";
import { draftFromEntry, entryFromDraft, type EntryDraft } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { LogEntry } from "@/lib/domain/entry";
import { services } from "@/lib/services";

function EditView() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");

  const [mediaId, setMediaId] = useState<string | null>(null);
  const [original, setOriginal] = useState<LogEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.log.getViewing(id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMediaId(res.value.mediaId);
        setOriginal(res.value.entry);
        setDraft(draftFromEntry(res.value.entry));
      } else {
        setProblem(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id || !draft || !original) return;
    setProblem(null);

    const entry = entryFromDraft(draft, original.media);
    if (!entry.ok) {
      setProblem(entry.error);
      return;
    }
    setBusy(true);
    const saved = await services.log.updateViewing(id, entry.value);
    if (!saved.ok) {
      setProblem(saved.error);
      setBusy(false);
      return;
    }
    router.replace(`/title/?id=${mediaId}`);
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No viewing selected.</main>;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      {busy && <LoadingOverlay label="Saving…" />}
      <Link href={mediaId ? `/title/?id=${mediaId}` : "/watchlist/"} className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-3xl tracking-tight">{original?.title ?? "Edit viewing"}</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {draft && (
        <form onSubmit={onSave} className="flex flex-col gap-5">
          <EntryForm draft={draft} onChange={setDraft} lockTitle disabled={busy} />
          <button type="submit" disabled={busy}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            Save changes
          </button>
        </form>
      )}
    </main>
  );
}

export default function EntryPage() {
  return (
    <Suspense>
      <EditView />
    </Suspense>
  );
}
