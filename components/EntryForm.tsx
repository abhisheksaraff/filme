// components/EntryForm.tsx
// Editable fields for one viewing. The parent owns the draft; this only edits it.
"use client";

import { useState } from "react";
import { FORMAT_ADDONS, PRIMARY_FORMATS, type FormatAddon, type PrimaryFormat } from "@/lib/domain/formats";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/domain/media";
import TagInput from "./TagInput";
import { parseSeatTag, seatLabel, type DraftSeat, type EntryDraft } from "./entryDraft";

const field = "w-full rounded-2xl bg-neutral-100 px-4 py-3 text-base outline-none dark:bg-neutral-800";

interface Props {
  draft: EntryDraft;
  onChange: (next: EntryDraft) => void;
  /** Called after the user changes the title or type, so the parent can search TMDB. */
  onUserEdit?: (field: "title" | "category", next: EntryDraft) => void;
  /** Shown under the title box, such as a list of matching TMDB titles. */
  titleExtra?: React.ReactNode;
  /** Hides the type and title, for editing a viewing of a title that is already saved. */
  lockTitle?: boolean;
  disabled?: boolean;
}

// Shown A–Z; the lists in formats.ts stay in their own order.
const byName = (a: string, b: string) => a.localeCompare(b);
const FORMATS_SORTED = [...PRIMARY_FORMATS].sort(byName);
const ADDONS_SORTED = [...FORMAT_ADDONS].sort(byName);

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export default function EntryForm({ draft, onChange, onUserEdit, titleExtra, lockTitle, disabled }: Props) {
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => onChange({ ...draft, [key]: value });
  // Rarely used fields stay tucked away unless they already hold something.
  const [more, setMore] = useState(
    () => !!(draft.address || draft.auditorium || draft.time || draft.totalTickets || draft.notes || draft.seats.length || draft.addons.length),
  );
  const edit = (field: "title" | "category", next: EntryDraft) => {
    onChange(next);
    onUserEdit?.(field, next);
  };

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4">
      {!lockTitle && (
        <>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type">
          {MEDIA_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={draft.category === c}
              onClick={() => edit("category", { ...draft, category: c as MediaCategory })}
              className={`rounded-full px-4 py-2 text-sm ${draft.category === c ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Labeled label="Title">
            <input className={`${field} font-serif text-xl`} placeholder="Title" value={draft.title} onChange={(e) => edit("title", { ...draft, title: e.target.value })} />
          </Labeled>
          {titleExtra}
        </div>
        </>
      )}

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

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date">
          <input className={field} type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
        </Labeled>
        <Labeled label="Rating (1–10)">
          <input className={field} type="number" step="0.5" min="1" max="10" value={draft.rating} onChange={(e) => set("rating", e.target.value)} />
        </Labeled>
      </div>

      <Labeled label="Format">
        <select className={field} value={draft.primaryFormat} onChange={(e) => set("primaryFormat", e.target.value as PrimaryFormat)}>
          {FORMATS_SORTED.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Labeled>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="self-start px-1 text-sm text-neutral-500">
        {more ? "Fewer details" : "More details"}
      </button>

      {more && (
        <>
          <Labeled label="Address">
            <input className={field} value={draft.address} onChange={(e) => set("address", e.target.value)} />
          </Labeled>
          <Labeled label="Screen or hall">
            <input className={field} value={draft.auditorium} onChange={(e) => set("auditorium", e.target.value)} />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Time">
              <input className={field} value={draft.time} onChange={(e) => set("time", e.target.value)} />
            </Labeled>
            <Labeled label="Tickets">
              <input className={field} inputMode="numeric" value={draft.totalTickets} onChange={(e) => set("totalTickets", e.target.value)} />
            </Labeled>
          </div>
          <TagInput
            label="Add-ons"
            tags={draft.addons}
            options={ADDONS_SORTED}
            placeholder="Type to filter, Enter to add"
            onAdd={(texts) => {
              const fresh = (texts as FormatAddon[]).filter((t) => !draft.addons.includes(t));
              if (fresh.length > 0) set("addons", [...draft.addons, ...fresh]);
            }}
            onRemove={(index) => set("addons", draft.addons.filter((_, i) => i !== index))}
          />
          <TagInput
            label="Seats"
            tags={draft.seats.map(seatLabel)}
            placeholder="Like F12 or 102-F-12"
            onAdd={(texts) => {
              const seats = texts.map(parseSeatTag).filter((seat): seat is DraftSeat => seat !== null);
              if (seats.length > 0) set("seats", [...draft.seats, ...seats]);
            }}
            onRemove={(index) => set("seats", draft.seats.filter((_, i) => i !== index))}
          />
          <Labeled label="Notes">
            <textarea className={field} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Labeled>
        </>
      )}
    </fieldset>
  );
}
