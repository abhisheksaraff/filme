// app/stack/page.tsx
// Edits a completion card (a season or the series finished episode by episode). The card mirrors the last episode watched;
// whatever is changed here is kept on its own, and "Reset to automatic" goes back to mirroring.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import EntryForm from "@/components/EntryForm";
import { CancelButton } from "@/components/EntryActions";
import LoadingOverlay from "@/components/LoadingOverlay";
import { ConfirmPopup } from "@/components/Popup";
import ProblemPopup from "@/components/ProblemPopup";
import { draftFromEntry, entryFromDraft, type EntryDraft } from "@/components/entryDraft";
import { useRequireSession } from "@/hooks/useRequireSession";
import { viewingIdsOf, type StackNode } from "@/lib/domain/passes";
import type { LogEntry } from "@/lib/domain/entry";
import { loadSeasons } from "@/lib/logShow";
import type { StackFields } from "@/lib/ports/passes";
import { services } from "@/lib/services";
import { buildPasses, findStack } from "@/lib/showPasses";

type Ask = "save" | "cancel" | "reset" | "delete" | null;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function StackEditView() {
  const ready = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const mediaId = params.get("id");
  const sParam = params.get("s");
  const season = sParam === "show" ? null : Number(sParam);
  const passKey = params.get("k");

  const [node, setNode] = useState<StackNode | null>(null);
  const [title, setTitle] = useState("");
  const [original, setOriginal] = useState<LogEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [episodeIds, setEpisodeIds] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);

  useEffect(() => {
    if (!ready || !mediaId || !passKey) return;
    let cancelled = false;
    (async () => {
      const detail = await services.log.titleDetail(mediaId);
      if (cancelled) return;
      if (!detail.ok || detail.value.tmdbId === null) return setProblem(detail.ok ? "This show has no catalogue page." : detail.error);
      const [data, resets, edits] = await Promise.all([loadSeasons(detail.value.tmdbId), services.passes.resets(mediaId), services.passes.edits(mediaId)]);
      if (cancelled) return;
      if (!data.ok) return setProblem(data.error);
      const built = buildPasses(detail.value.viewings, data.value, resets.ok ? resets.value : [], new Date().toISOString().slice(0, 10));
      const found = findStack(built.stacks, season, passKey);
      if (!found) return setProblem("This card is no longer there.");
      const base = await services.log.getViewing(found.last.viewingId);
      if (cancelled) return;
      if (!base.ok) return setProblem(base.error);
      const saved = edits.ok ? edits.value.find((e) => e.season === season && e.passKey === passKey)?.fields : undefined;
      const { venueId: _a, venueLatitude: _b, venueLongitude: _c, ...own } = saved ?? {};
      void _a; void _b; void _c;
      const entry = base.value.entry;
      setTitle(detail.value.title);
      setNode(found);
      setOriginal(entry);
      setDraft({ ...draftFromEntry({ ...entry, ...own }), season: season === null ? "" : String(season), episode: "" });
      const scopes = new Map(detail.value.viewings.map((v) => [v.id, v.scope] as const));
      setEpisodeIds(viewingIdsOf(found).filter((id) => scopes.get(id) === "episode"));
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, mediaId, passKey, season]);

  function leave() {
    if (window.history.length > 1) router.back();
    else router.replace(mediaId ? `/title/?id=${mediaId}` : "/watchlist/");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAsk("save");
  }

  /** Keeps only what differs from the last episode, so everything else keeps mirroring it. */
  async function onSave() {
    if (!mediaId || !passKey || !draft || !original) return;
    const entry = entryFromDraft(draft, null);
    if (!entry.ok) return setProblem(entry.error);
    const next = entry.value;
    const fields: StackFields = {};
    if (!same(next.location, original.location) || !same(next.address, original.address) || !same(next.venueType, original.venueType)) {
      fields.location = next.location;
      fields.address = next.address;
      fields.venueType = next.venueType ?? null;
      if (next.location) {
        const found = await services.browse.searchVenues(next.location);
        const hit = found.ok ? found.value.find((v) => v.name.toLowerCase() === (next.location ?? "").toLowerCase()) : undefined;
        const points = hit ? await services.browse.venuePoints() : null;
        const point = points?.ok ? points.value.find((p) => p.id === hit?.id) : undefined;
        fields.venueId = hit?.id ?? null;
        fields.venueLatitude = point?.latitude ?? null;
        fields.venueLongitude = point?.longitude ?? null;
      }
    }
    if (!same(next.auditorium, original.auditorium)) fields.auditorium = next.auditorium;
    if (!same(next.date, original.date)) fields.date = next.date;
    if (!same(next.time, original.time)) fields.time = next.time;
    if (!same(next.seats, original.seats)) fields.seats = next.seats;
    if (!same(next.totalTickets, original.totalTickets)) fields.totalTickets = next.totalTickets;
    if (!same(next.primaryFormat, original.primaryFormat)) fields.primaryFormat = next.primaryFormat;
    if (!same(next.addons, original.addons)) fields.addons = next.addons;
    if (!same(next.rating, original.rating)) fields.rating = next.rating;
    if (!same(next.notes, original.notes)) fields.notes = next.notes;

    setBusy(true);
    const res = Object.keys(fields).length === 0 ? await services.passes.clearEdit(mediaId, season, passKey) : await services.passes.saveEdit(mediaId, season, passKey, fields);
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    leave();
  }

  async function onReset() {
    if (!mediaId || !passKey) return;
    setBusy(true);
    const res = await services.passes.clearEdit(mediaId, season, passKey);
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    leave();
  }

  /** Deletes every episode viewing in this pass; they wait in Recently deleted for 24 hours. */
  async function onDelete() {
    if (!mediaId || !passKey) return;
    setBusy(true);
    for (const id of episodeIds) {
      const res = await services.log.deleteViewing(id);
      if (!res.ok) {
        setBusy(false);
        setAsk(null);
        return setProblem(res.error);
      }
    }
    await services.passes.clearEdit(mediaId, season, passKey);
    setBusy(false);
    router.replace("/watchlist/");
  }

  if (!ready) return null;
  if (!mediaId || !passKey) return <main className="p-6 text-sm">No card selected.</main>;
  const label = season === null ? "Series completed" : `Season ${season} completed`;

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 py-8">
      <LoadingOverlay active={busy} hiddenAtStart />
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl tracking-tight">{title || "Completed"}</h1>
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {draft && node && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <p className="text-sm text-neutral-500">This card copies the last episode you watched. Anything you change here stays as you set it.</p>
          <EntryForm draft={draft} onChange={setDraft} disabled={busy} lockTitle hideScope />
          <button type="submit" disabled={busy} className="rounded-2xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            Save changes
          </button>
          <button type="button" disabled={busy} onClick={() => setAsk("reset")}
            className="rounded-2xl bg-neutral-100 px-5 py-3 text-base font-medium text-neutral-700 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200">
            Reset to automatic
          </button>
          <CancelButton shape="box" disabled={busy} onClick={() => setAsk("cancel")} />
          <button type="button" disabled={busy} onClick={() => setAsk("delete")} className="self-center py-2 text-sm font-medium text-neutral-950 disabled:opacity-40 dark:text-white">
            Delete
          </button>
        </form>
      )}

      {ask === "save" && <ConfirmPopup title="Save your changes?" message="This card keeps these details from now on." confirmLabel="Save" busy={busy} onConfirm={() => { setAsk(null); void onSave(); }} onCancel={() => setAsk(null)} />}
      {ask === "cancel" && <ConfirmPopup title="Discard your changes?" message="Your edits won't be saved." confirmLabel="Discard" confirmIcon="trash" onConfirm={() => { setAsk(null); leave(); }} onCancel={() => setAsk(null)} />}
      {ask === "reset" && <ConfirmPopup title="Go back to automatic?" message="The card will copy the last episode again, and your changes are removed." confirmLabel="Reset" confirmIcon="refresh" busy={busy} onConfirm={() => { setAsk(null); void onReset(); }} onCancel={() => setAsk(null)} />}
      {ask === "delete" && (
        <ConfirmPopup title="Delete this card?" message={`This also deletes the ${episodeIds.length} ${episodeIds.length === 1 ? "episode" : "episodes"} watched in it. You can restore them from Watched for 24 hours.`}
          confirmLabel="Delete" confirmIcon="trash" busy={busy} onConfirm={() => void onDelete()} onCancel={() => setAsk(null)} />
      )}
    </main>
  );
}

export default function StackEditPage() {
  return (
    <Suspense>
      <StackEditView />
    </Suspense>
  );
}
