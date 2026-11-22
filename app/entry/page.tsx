// app/entry/page.tsx
// Edits one saved viewing, including its title or type.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import EntryForm from "@/components/EntryForm";
import { ConfirmPopup } from "@/components/Popup";
import SessionPicturesEditor from "@/components/SessionPicturesEditor";
import LoadingOverlay from "@/components/LoadingOverlay";
import { CancelButton, RescanButton } from "@/components/EntryActions";
import { TitleHits, useTitleHits } from "@/components/TitleHits";
import { OcrClient } from "@/lib/ocrClient";
import { changesFromEdit, draftFromEntry, draftFromExtraction, emptyPeople, entryFromDraft, mediaFromCatalog, peopleFromMatch, PERSON_ROLES, titleAfterPick, withoutMatchPeople, type EntryDraft, type PeopleDraft } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import type { EntryMedia, LogEntry } from "@/lib/domain/entry";
import type { CatalogHit } from "@/lib/ports/catalog";
import { savePeople, syncCredits } from "@/lib/credits";
import { withCoverage } from "@/lib/logShow";
import { previousPath } from "@/lib/pageMemory";
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
  /** The TMDB title this viewing is linked to; a typed title never changes it, only picking another or the chip's x does. */
  const [media, setMedia] = useState<EntryMedia | null>(null);
  const [ticketUrls, setTicketUrls] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"save" | "cancel" | "rescan" | null>(null);
  const { hits, done } = useTitleHits(draft?.title ?? "", draft?.category ?? "Movie", draft !== null && draft.title !== original?.title);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.log.getViewing(id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMediaId(res.value.mediaId);
        setOriginal(res.value.entry);
        setMedia(res.value.entry.media);
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

  /** Goes back to the page that opened this one, keeping its scroll and open card; `fallback` is used when there is no such page. */
  function leave(fallback: string) {
    if (window.history.length > 1) router.back();
    else router.replace(fallback);
  }

  /** Saving asks first; the form's own submit only opens that question. */
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setConfirm("save");
  }

  async function onSave() {
    if (!id || !draft || !original) return;
    setProblem(null);

    const entry = entryFromDraft(draft, media);
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
    // Back to the page the edit was opened from, at the same place; a changed title has no such page to go back to.
    if (sameTitle) leave(`/title/?id=${saved.value.mediaId}`);
    else router.replace(`/title/?id=${saved.value.mediaId}`);
  }

  /** A TMDB title picked from the list: it becomes the link and brings its cast and crew; the typed words stay if they already contain its name. */
  async function pickHit(hit: CatalogHit) {
    done();
    setBusy(true);
    const details = await services.catalog.details(hit);
    setBusy(false);
    if (!details.ok) return setProblem(details.error);
    setMedia(mediaFromCatalog(details.value));
    setDraft((current) => (current ? { ...current, title: titleAfterPick(current.title, details.value.title), category: hit.kind, people: peopleFromMatch(current.people, details.value) } : current));
  }

  /** Reads the saved ticket pictures again and fills the form from them, keeping the rating, notes and people. */
  async function rescan() {
    setBusy(true);
    setProblem(null);
    try {
      const pictures = await Promise.all(ticketUrls.map(async (url) => {
        const blob = await (await fetch(url)).blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read a ticket picture."));
          reader.readAsDataURL(blob);
        });
      }));
      const texts = await OcrClient.extractTextFromImages(pictures);
      const combined = texts.filter(Boolean).join("\n--- PAGE BREAK ---\n");
      if (!combined.trim()) return setProblem("Could not detect any readable text on the tickets.");
      const result = await services.ai.extractTicket(combined, true);
      if (!result.ok) return setProblem(result.error);
      setDraft((current) => (current ? { ...draftFromExtraction(result.value), people: current.people, rating: current.rating, notes: current.notes } : current));
      const name = result.value.tmdbTitle ?? result.value.title;
      if (name) {
        setMedia(null);
        const found = await services.catalog.findClosest(name, result.value.category ?? "Movie");
        if (found.ok && found.value) {
          const details = await services.catalog.details(found.value);
          if (details.ok) {
            setMedia(mediaFromCatalog(details.value));
            setDraft((current) => (current ? { ...current, people: peopleFromMatch(withoutMatchPeople(current.people), details.value) } : current));
          }
        }
      }
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not rescan the tickets.");
    } finally {
      setBusy(false);
    }
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
    // Back to where the edit began, unless that was this title's page and its only viewing is gone.
    if (left.ok && left.value.viewings.length > 0) leave(`/title/?id=${mediaId}`);
    else if (previousPath().startsWith("/title/")) router.replace("/watchlist/");
    else leave("/watchlist/");
  }

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No viewing selected.</main>;

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 py-8">
      <LoadingOverlay active={busy} hiddenAtStart />
            <h1 className="font-serif text-3xl tracking-tight">{original?.title ?? "Edit viewing"}</h1>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {draft && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <EntryForm
            draft={draft}
            onChange={setDraft}
            disabled={busy}
            showTmdbId={draft.category === "TV Show" ? (media?.tmdbId ?? null) : null}
            titleExtra={<TitleHits hits={hits} onPick={pickHit} />}
            link={media ? { tmdbId: media.tmdbId, label: `${media.title}${media.releaseDate ? ` · ${media.releaseDate.slice(0, 4)}` : ""}`, onClear: () => { setMedia(null); setDraft((current) => (current ? { ...current, people: withoutMatchPeople(current.people) } : current)); } } : null}
          />
          {id && <SessionPicturesEditor sessionId={id} onTickets={setTicketUrls} />}
          {ticketUrls.length > 0 && <RescanButton shape="box" disabled={busy} onClick={() => setConfirm("rescan")} />}
          <button type="submit" disabled={busy}
            className="rounded-2xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900 wide:w-60 wide:self-center">
            Save changes
          </button>
          <CancelButton shape="box" disabled={busy} onClick={() => setConfirm("cancel")} />
          {/* Plain black text, not a button; it asks before anything is deleted. */}
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="self-center py-2 text-sm font-medium text-neutral-950 disabled:opacity-40 dark:text-white">
            Delete
          </button>
        </form>
      )}
      {confirm === "save" && (
        <ConfirmPopup title="Save your changes?" message="This updates the viewing." confirmLabel="Save" busy={busy}
          onConfirm={() => { setConfirm(null); void onSave(); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === "cancel" && (
        <ConfirmPopup title="Discard your changes?" message="Your edits won't be saved." confirmLabel="Discard" confirmIcon="trash"
          onConfirm={() => { setConfirm(null); leave(id ? `/title/?id=${mediaId ?? ""}` : "/watchlist/"); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === "rescan" && (
        <ConfirmPopup title="Rescan your tickets?" message="What your tickets say will replace the details filled in above." confirmLabel="Rescan" confirmIcon="refresh"
          onConfirm={() => { setConfirm(null); void rescan(); }} onCancel={() => setConfirm(null)} />
      )}
      {confirmDelete && (
        <ConfirmPopup title="Delete this viewing?" message="You can restore it from Watched for 24 hours." confirmLabel="Delete" confirmIcon="trash" busy={busy} onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
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
