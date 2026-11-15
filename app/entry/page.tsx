// app/entry/page.tsx
// Edits one saved viewing, including its title or type.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import EntryForm from "@/components/EntryForm";
import { ConfirmPopup } from "@/components/Popup";
import SessionPicturesEditor from "@/components/SessionPicturesEditor";
import LoadingOverlay from "@/components/LoadingOverlay";
import { changesFromEdit, draftFromEntry, emptyPeople, entryFromDraft, PERSON_ROLES, type EntryDraft, type PeopleDraft } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { LogEntry } from "@/lib/domain/entry";
import { savePeople, syncCredits } from "@/lib/credits";
import { withCoverage } from "@/lib/logShow";
import { services } from "@/lib/services";

function EditView() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");

  const [mediaId, setMediaId] = useState<string | null>(null);
  const [original, setOriginal] = useState<LogEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  /** The title's cast and crew as loaded, to work out what the user changed. */
  const [loadedPeople, setLoadedPeople] = useState<PeopleDraft>(emptyPeople);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.log.getViewing(id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMediaId(res.value.mediaId);
        setOriginal(res.value.entry);
        services.browse.titleCredits(res.value.mediaId).then((credits) => {
          if (cancelled) return;
          const people = emptyPeople();
          if (credits.ok) {
            // Billed cast first in billing order; people added by hand (order -1) and crew after.
            const rank = (order: number | null) => (order === null || order < 0 ? 999 : order);
            const ordered = [...credits.value.people].sort((a, b) => rank(a.order) - rank(b.order));
            for (const p of ordered) {
              const role = PERSON_ROLES.find((r) => r === p.role);
              if (role) people[role].push({ personId: p.personId, tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath, character: p.character, fromMatch: p.tmdbId !== null && (p.order === null || p.order >= 0) });
            }
          }
          setLoadedPeople(people);
          setDraft((current) => (current ? { ...current, people } : current));
        });
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
    const saved = await services.log.updateViewing(id, await withCoverage(entry.value));
    if (!saved.ok) {
      setProblem(saved.error);
      setBusy(false);
      return;
    }
    // Cast and crew edits apply to the title, so they only make sense against the title they were loaded from.
    const sameTitle = saved.value.mediaId === mediaId;
    const changes = changesFromEdit(sameTitle ? loadedPeople : emptyPeople(), draft.people, entry.value.category);
    if (changes.added.length > 0 || changes.removed.length > 0) await savePeople(saved.value.mediaId, changes.added, changes.removed);
    // A changed title may be a new one that has no genres or cast yet.
    const tmdbId = entry.value.media?.tmdbId;
    if (tmdbId && (entry.value.category === "Movie" || entry.value.category === "TV Show")) {
      void syncCredits(saved.value.mediaId, entry.value.category, tmdbId);
    }
    router.replace(`/title/?id=${saved.value.mediaId}&v=${id}`);
  }

  async function onDelete() {
    if (!id || !mediaId) return;
    setBusy(true);
    const res = await services.log.deleteViewing(id);
    if (!res.ok) {
      setBusy(false);
      setConfirmDelete(false);
      return setProblem(res.error);
    }
    // Back to the title, unless that was its only viewing; then the title has nothing to show.
    const left = await services.log.titleDetail(mediaId);
    router.replace(left.ok && left.value.viewings.length > 0 ? `/title/?id=${mediaId}` : "/watchlist/");
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No viewing selected.</main>;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      {busy && <LoadingOverlay label="Saving…" />}
            <h1 className="font-serif text-3xl tracking-tight">{original?.title ?? "Edit viewing"}</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      {draft && (
        <form onSubmit={onSave} className="flex flex-col gap-5">
          <EntryForm draft={draft} onChange={setDraft} disabled={busy} showTmdbId={draft.category === "TV Show" ? (original?.media?.tmdbId ?? null) : null} />
          {id && <SessionPicturesEditor sessionId={id} />}
          <button type="submit" disabled={busy}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            Save changes
          </button>
          {/* Plain black text, not a button; it asks before anything is deleted. */}
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="self-center py-2 text-sm font-medium text-neutral-950 disabled:opacity-40 dark:text-white">
            Delete
          </button>
        </form>
      )}
      {confirmDelete && (
        <ConfirmPopup title="Delete this viewing?" message="You can restore it from Watched for 24 hours." confirmLabel="Delete" cancelLabel="Keep" busy={busy} onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
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
