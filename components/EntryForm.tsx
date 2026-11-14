// components/EntryForm.tsx
// Editable fields for one viewing. The parent owns the draft; this only edits it.
"use client";

import { FORMAT_ADDONS, PRIMARY_FORMATS, type FormatAddon, type PrimaryFormat } from "@/lib/domain/formats";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/domain/media";
import type { EntryDraft, DraftSeat } from "./entryDraft";

const field =
  "w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700";
const small = "rounded-xl border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700";

interface Props {
  draft: EntryDraft;
  onChange: (next: EntryDraft) => void;
  disabled?: boolean;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export default function EntryForm({ draft, onChange, disabled }: Props) {
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => onChange({ ...draft, [key]: value });
  const setSeat = (index: number, patch: Partial<DraftSeat>) =>
    set("seats", draft.seats.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const toggleAddon = (addon: FormatAddon) =>
    set("addons", draft.addons.includes(addon) ? draft.addons.filter((a) => a !== addon) : [...draft.addons, addon]);

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4">
      <Labeled label="Type">
        <select className={field} value={draft.category} onChange={(e) => set("category", e.target.value as MediaCategory)}>
          {MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Labeled>

      <Labeled label="Title">
        <input className={field} value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </Labeled>

      {draft.category === "TV Show" && (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Season">
            <input className={field} inputMode="numeric" value={draft.season} onChange={(e) => set("season", e.target.value)} />
          </Labeled>
          <Labeled label="Episode">
            <input className={field} inputMode="numeric" value={draft.episode} onChange={(e) => set("episode", e.target.value)} />
          </Labeled>
          <div className="col-span-2">
            <Labeled label="Episode title">
              <input className={field} value={draft.episodeTitle} onChange={(e) => set("episodeTitle", e.target.value)} />
            </Labeled>
          </div>
        </div>
      )}

      <Labeled label="Venue">
        <input className={field} value={draft.location} onChange={(e) => set("location", e.target.value)} />
      </Labeled>
      <Labeled label="Address">
        <input className={field} value={draft.address} onChange={(e) => set("address", e.target.value)} />
      </Labeled>
      <Labeled label="Screen or hall">
        <input className={field} value={draft.auditorium} onChange={(e) => set("auditorium", e.target.value)} />
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date">
          <input className={field} type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
        </Labeled>
        <Labeled label="Time">
          <input className={field} value={draft.time} onChange={(e) => set("time", e.target.value)} />
        </Labeled>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Tickets">
          <input className={field} inputMode="numeric" value={draft.totalTickets} onChange={(e) => set("totalTickets", e.target.value)} />
        </Labeled>
        <Labeled label="Rating (1–10)">
          <input className={field} type="number" step="0.5" min="1" max="10" value={draft.rating} onChange={(e) => set("rating", e.target.value)} />
        </Labeled>
      </div>

      <Labeled label="Format">
        <select className={field} value={draft.primaryFormat} onChange={(e) => set("primaryFormat", e.target.value as PrimaryFormat)}>
          {PRIMARY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Labeled>

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Add-ons{draft.addons.length > 0 && ` (${draft.addons.length})`}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {FORMAT_ADDONS.map((addon) => (
            <label key={addon} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.addons.includes(addon)} onChange={() => toggleAddon(addon)} />
              {addon}
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Seats</span>
        {draft.seats.map((seat, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} placeholder="Section" value={seat.section} onChange={(e) => setSeat(i, { section: e.target.value })} />
            <input className={field} placeholder="Row" value={seat.row} onChange={(e) => setSeat(i, { row: e.target.value })} />
            <input className={field} placeholder="Seat" value={seat.seat} onChange={(e) => setSeat(i, { seat: e.target.value })} />
            <button type="button" className={small} onClick={() => set("seats", draft.seats.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className={small} onClick={() => set("seats", [...draft.seats, { section: "", row: "", seat: "" }])}>
          Add a seat
        </button>
      </div>

      <Labeled label="Notes">
        <textarea className={field} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      </Labeled>
    </fieldset>
  );
}
