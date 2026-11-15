// components/EntryForm.tsx
// Editable fields for one viewing. The parent owns the draft; this only edits it.
"use client";

import { useEffect, useRef, useState } from "react";
import { FORMAT_ADDONS, PRIMARY_FORMATS, type FormatAddon, type PrimaryFormat } from "@/lib/domain/formats";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/domain/media";
import { services } from "@/lib/services";
import Icon from "./Icon";
import PeopleInput from "./PeopleInput";
import TagInput from "./TagInput";
import { parseSeatTag, rolesFor, ROLE_LABEL, seatLabel, type DraftSeat, type EntryDraft } from "./entryDraft";

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
  /** A round button kept at the right of the type choices, such as ticket upload. */
  typeAction?: React.ReactNode;
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

interface VenueSuggestion {
  key: string;
  name: string;
  address: string;
  own: boolean;
}

/** Past venues first (matching name or address), then places from the map service. */
async function findVenues(query: string): Promise<VenueSuggestion[]> {
  const [own, places] = await Promise.all([services.browse.searchVenues(query), services.geo.search(query)]);
  const mine: VenueSuggestion[] = own.ok ? own.value.map((v) => ({ key: `own-${v.id}`, name: v.name, address: v.address ?? "", own: true })) : [];
  const seen = new Set(mine.map((m) => `${m.name}|${m.address}`.toLowerCase()));
  const found: VenueSuggestion[] = places.ok
    ? places.value.map((p, i) => ({ key: `map-${i}`, name: p.name, address: p.address, own: false })).filter((p) => !seen.has(`${p.name}|${p.address}`.toLowerCase()))
    : [];
  return [...mine, ...found];
}

export default function EntryForm({ draft, onChange, onUserEdit, titleExtra, lockTitle, typeAction, disabled }: Props) {
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => onChange({ ...draft, [key]: value });
  // Rarely used fields stay tucked away unless they already hold something.
  const [more, setMore] = useState(
    () => !!(draft.address || draft.auditorium || draft.time || draft.totalTickets || draft.notes || draft.seats.length || draft.addons.length),
  );
  const [suggest, setSuggest] = useState<{ field: "location" | "address"; items: VenueSuggestion[] } | null>(null);
  const [typed, setTyped] = useState<{ field: "location" | "address"; text: string } | null>(null);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });

  // Suggestions follow the venue or address box a moment after typing stops.
  useEffect(() => {
    if (!typed) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const items = typed.text.trim().length >= 2 ? await findVenues(typed.text) : [];
      if (!stale) setSuggest({ field: typed.field, items });
    }, 600);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [typed]);

  function typeVenue(field: "location" | "address", text: string) {
    setTyped({ field, text });
    set(field, text);
  }

  /** Picking a suggestion fills the name and the address together. */
  function chooseVenue(item: VenueSuggestion) {
    setTyped(null);
    setSuggest(null);
    onChange({ ...draft, location: item.name, address: item.address || draft.address });
  }

  /** "Home" with no address reuses the last home's name and address. */
  async function typeScreen(text: string) {
    set("auditorium", text);
    if (text.trim().toLowerCase() !== "home" || latest.current.address.trim()) return;
    const home = await services.browse.lastHome();
    if (!home.ok || !home.value) return;
    const now = latest.current;
    if (now.address.trim() || now.auditorium.trim().toLowerCase() !== "home") return;
    onChange({ ...now, location: now.location.trim() || home.value.name, address: home.value.address ?? "" });
  }

  const suggestionList = (fieldName: "location" | "address") =>
    suggest?.field === fieldName && suggest.items.length > 0 ? (
      <ul className="flex flex-col overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
        {suggest.items.map((item) => (
          <li key={item.key}>
            <button type="button" onClick={() => chooseVenue(item)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
                <Icon name={item.own ? "ticket" : "map"} size={15} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.name}</span>
                {item.address && <span className="truncate text-xs text-neutral-500">{item.address}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  const edit = (field: "title" | "category", next: EntryDraft) => {
    onChange(next);
    onUserEdit?.(field, next);
  };

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4">
      {!lockTitle && (
        <>
        {/* The button keeps its own column, top-aligned with the first row of choices however many rows they take. */}
        <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-2" role="radiogroup" aria-label="Type">
          {MEDIA_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={draft.category === c}
              onClick={() => edit("category", { ...draft, category: c as MediaCategory })}
              className={`rounded-full px-4 py-2 text-sm ${draft.category === c ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
              {c}
            </button>
          ))}
        </div>
        {typeAction && <div className="shrink-0">{typeAction}</div>}
        </div>

        <div className="flex flex-col gap-2">
          <Labeled label="Title">
            <input className={`${field} font-serif text-xl`} placeholder="Title" value={draft.title} onChange={(e) => edit("title", { ...draft, title: e.target.value })} />
          </Labeled>
          {titleExtra}
        </div>
        {rolesFor(draft.category).map((role) => (
          <PeopleInput key={role} label={ROLE_LABEL[role]} people={draft.people[role]} onChange={(next) => set("people", { ...draft.people, [role]: next })} disabled={disabled} />
        ))}
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
          <p className="col-span-2 -mt-1 text-xs text-neutral-500">Leave both empty to log the whole series, or the episode empty to log the whole season.</p>
          <div className="col-span-2">
            <Labeled label="Episode title">
              <input className={field} value={draft.episodeTitle} onChange={(e) => set("episodeTitle", e.target.value)} />
            </Labeled>
          </div>
        </div>
      )}

      <Labeled label="Venue">
        <input className={field} value={draft.location} onChange={(e) => typeVenue("location", e.target.value)} />
      </Labeled>
      {suggestionList("location")}

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
            <input className={field} value={draft.address} onChange={(e) => typeVenue("address", e.target.value)} />
          </Labeled>
          {suggestionList("address")}
          <Labeled label="Screen or hall">
            <input className={field} value={draft.auditorium} onChange={(e) => void typeScreen(e.target.value)} />
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
