// components/EntryForm.tsx
// Editable fields for one viewing. The parent owns the draft; this only edits it.
"use client";

import RatingSlider from "@/components/ui/RatingSlider";
import { AREA, FIELD_SM_FULL } from "@/components/ui/fields";
import { useEffect, useRef, useState } from "react";
import { FORMAT_ADDONS, PRIMARY_FORMATS, type FormatAddon, type PrimaryFormat } from "@/lib/domain/formats";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/domain/media";
import { useShowData } from "@/hooks/useShowData";
import { services } from "@/lib/services";
import { defaultVenueType, normalizeVenueType, venueIcon, venueTypeLabel, VENUE_TYPES, type VenueType } from "@/lib/domain/venueTypes";
import Icon from "./Icon";
import PeopleInput from "./PeopleInput";
import TagInput from "./TagInput";
import { parseSeatTag, rolesFor, ROLE_LABEL, seatLabel, type DraftSeat, type EntryDraft } from "./entryDraft";
import DateField from "@/components/ui/DateField";
import SuggestionList, { SUGGESTION_NOTE, SuggestionItem } from "@/components/ui/SuggestionList";
import { yearChoices } from "@/lib/domain/years";

const field = FIELD_SM_FULL;

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
  /** The matched show on TMDB; when set, Season and Episode become lists of its real seasons and episodes. */
  showTmdbId?: number | null;
  /** The TMDB title this entry is linked to; shown as a read-only id with a chip whose x unlinks it. */
  link?: { tmdbId: number; label: string; onClear: () => void } | null;
}

// Shown A–Z; the lists in formats.ts stay in their own order.
const byName = (a: string, b: string) => a.localeCompare(b);
const FORMATS_SORTED = [...PRIMARY_FORMATS].sort(byName);
const ADDONS_SORTED = [...FORMAT_ADDONS].sort(byName);

function Labeled({ label, children, plain = false }: { label: string; children: React.ReactNode; plain?: boolean }) {
  // A date box with an x inside a <label> sends the x's taps to the date picker, so those use a plain wrapper.
  const Wrap = plain ? "div" : "label";
  return (
    <Wrap className="flex flex-col gap-1">
      <span className="px-1 text-xs text-neutral-500">{label}</span>
      {children}
    </Wrap>
  );
}

interface VenueSuggestion {
  key: string;
  name: string;
  address: string;
  own: boolean;
  /** The kind of place, for own venues: what it was the last time it was used. */
  type: string | null;
  /** The day it was last used, for own venues. */
  lastOn: string | null;
}

/** Past venues first (matching name or address, the most recently visited first), then places from the map service. */
async function findVenues(query: string): Promise<VenueSuggestion[]> {
  const [own, places] = await Promise.all([services.browse.searchVenues(query), services.geo.search(query)]);
  const mine: VenueSuggestion[] = own.ok ? own.value.map((v) => ({ key: `own-${v.id}`, name: v.name, address: v.address ?? "", own: true, type: v.lastType ?? v.type, lastOn: v.lastWatchedOn })) : [];
  const seen = new Set(mine.map((m) => `${m.name}|${m.address}`.toLowerCase()));
  const found: VenueSuggestion[] = places.ok
    ? places.value.map((p, i) => ({ key: `map-${i}`, name: p.name, address: p.address, own: false, type: null, lastOn: null })).filter((p) => !seen.has(`${p.name}|${p.address}`.toLowerCase()))
    : [];
  return [...mine, ...found];
}

export default function EntryForm({ draft, onChange, onUserEdit, titleExtra, lockTitle, typeAction, disabled, showTmdbId = null, link = null }: Props) {
  const show = useShowData(showTmdbId, showTmdbId !== null);
  const seasonList = show?.seasons ?? [];
  const episodeList = seasonList.find((x) => String(x.season) === draft.season)?.episodes ?? [];
  // How much of the date is known: the whole day, the month, only the year, or nothing.
  const [when, setWhen] = useState<"day" | "month" | "year" | "none">(() => (draft.date.length === 7 ? "month" : draft.date.length === 4 ? "year" : "day"));
  const shownWhen = draft.date ? (draft.date.length === 7 ? "month" : draft.date.length === 4 ? "year" : "day") : when;
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => onChange({ ...draft, [key]: value });
  // Rarely used fields stay tucked away unless they already hold something.
  const [more, setMore] = useState(
    () => !!(draft.auditorium || draft.totalTickets || draft.notes || draft.seats.length || draft.addons.length),
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

  // The list stays open while you move between the venue and address boxes or tap a suggestion; a tap anywhere else closes it.
  const listOpen = suggest !== null;
  useEffect(() => {
    if (!listOpen) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-venue-suggest]")) setSuggest(null);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [listOpen]);

  function typeVenue(field: "location" | "address", text: string) {
    setTyped({ field, text });
    set(field, text);
  }

  /** Picking a suggestion fills the name and the address together. */
  function chooseVenue(item: VenueSuggestion) {
    const fromAddress = suggest?.field === "address";
    setTyped(null);
    setSuggest(null);
    if (fromAddress) {
      // Choosing from the address box fills only the address; the name you typed stays, and is only filled when it was empty.
      onChange({
        ...draft,
        location: draft.location.trim() ? draft.location : item.name,
        address: item.address || draft.address,
        venueType: draft.venueType ?? (item.own ? normalizeVenueType(item.type) : null),
      });
      return;
    }
    // Choosing from the venue box fills the name and the address together; an own venue brings back the kind of place it was last used as.
    onChange({ ...draft, location: item.name, address: item.address || draft.address, venueType: item.own ? normalizeVenueType(item.type) : draft.venueType });
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

  /** Enter keeps exactly what was typed (it may be a name no map knows, like "Home") and never submits the form. */
  function keepAsTyped(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    setTyped(null);
    setSuggest(null);
  }

  const [typeMenu, setTypeMenu] = useState(false);
  // Until a kind is picked, it follows the name (Home is a home) and the kind of thing being logged.
  const autoType: VenueType = draft.location.trim().toLowerCase() === "home" ? "home" : defaultVenueType(draft.category);
  const shownType = draft.venueType ?? autoType;

  const suggestionList = (fieldName: "location" | "address") =>
    suggest?.field === fieldName && suggest.items.length > 0 ? (
      <SuggestionList data-venue-suggest scroll>
        {suggest.items.map((item) => (
          <SuggestionItem key={item.key}>
            <button type="button" onClick={() => chooseVenue(item)} className="press flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
                <Icon name={item.own ? venueIcon(item.type) : "map"} size={15} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.name}</span>
                {item.address && <span className={`line-clamp-2 ${SUGGESTION_NOTE}`}>{item.address}</span>}
                {item.lastOn && <span className={SUGGESTION_NOTE}>last {item.lastOn}</span>}
              </span>
            </button>
          </SuggestionItem>
        ))}
      </SuggestionList>
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
            <input className={field} placeholder="Title of the movie, show or event" value={draft.title} onChange={(e) => edit("title", { ...draft, title: e.target.value })} />
          </Labeled>
          {titleExtra}
          {link && (
            <>
              <Labeled label="TMDB ID" plain><input readOnly value={link.tmdbId} className={`${field} text-neutral-500`} aria-label="TMDB ID" /></Labeled>
              <div className="flex">
                <span className="flex items-center gap-1 rounded-full bg-neutral-950 py-1 pl-3 pr-1 text-xs text-white dark:bg-white dark:text-neutral-950">
                  <span>{link.label}</span>
                  <button type="button" aria-label={`Unlink ${link.label}`} onClick={link.onClear} className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/20 before:absolute before:-inset-2 before:content-[''] dark:bg-black/15"><Icon name="close" size={11} /></button>
                </span>
              </div>
            </>
          )}
        </div>
        {rolesFor(draft.category).map((role) => (
          <PeopleInput key={role} label={ROLE_LABEL[role]} people={draft.people[role]} onChange={(next) => set("people", { ...draft.people, [role]: next })} disabled={disabled} />
        ))}
        </>
      )}

      {draft.category === "TV Show" && (
        <div className="grid grid-cols-2 gap-3">
          {seasonList.length > 0 ? (
            <>
              <Labeled label="Season">
                <select className={field} value={draft.season} onChange={(e) => onChange({ ...draft, season: e.target.value, episode: "" })}>
                  <option value="">Whole series</option>
                  {seasonList.map((x) => <option key={x.season} value={String(x.season)}>Season {x.season}</option>)}
                </select>
              </Labeled>
              <Labeled label="Episode">
                <select className={field} value={draft.episode} disabled={!draft.season} onChange={(e) => set("episode", e.target.value)}>
                  <option value="">Whole season</option>
                  {episodeList.map((x) => <option key={x.episode} value={String(x.episode)}>E{x.episode}{x.name ? ` · ${x.name}` : ""}</option>)}
                </select>
              </Labeled>
            </>
          ) : (
            <>
              <Labeled label="Season">
                <input className={field} inputMode="numeric" placeholder="Season number" value={draft.season} onChange={(e) => set("season", e.target.value)} />
              </Labeled>
              <Labeled label="Episode">
                <input className={field} inputMode="numeric" placeholder="Episode number" value={draft.episode} onChange={(e) => set("episode", e.target.value)} />
              </Labeled>
              <p className="col-span-2 -mt-1 text-xs text-neutral-500">Leave both empty to log the whole series, or the episode empty to log the whole season.</p>
            </>
          )}
          <div className="col-span-2">
            <Labeled label="Episode title">
              <input className={field} placeholder="Name of the episode" value={draft.episodeTitle} onChange={(e) => set("episodeTitle", e.target.value)} />
            </Labeled>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="px-1 text-xs text-neutral-500">Venue</span>
        {/* One pill: a small menu for the kind of place on the left, a thin grey line, then the name to type. */}
        <div className="relative flex h-10 items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <button type="button" aria-haspopup="menu" aria-expanded={typeMenu} aria-label={`Kind of place: ${venueTypeLabel(shownType)}`} onClick={() => setTypeMenu((o) => !o)} className="flex h-full shrink-0 items-center gap-1 pl-4 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-white"><Icon name={venueIcon(shownType)} size={16} /></span>
            <Icon name="chevronDown" size={13} />
          </button>
          <span aria-hidden className="h-5 w-px shrink-0 bg-neutral-300 dark:bg-neutral-600" />
          <input className="h-full min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-sm" data-venue-suggest placeholder="Theatre, venue or place" value={draft.location} onKeyDown={keepAsTyped} onChange={(e) => typeVenue("location", e.target.value)} />
          {typeMenu && (
            <>
              <button type="button" aria-label="Close" onClick={() => setTypeMenu(false)} className="fixed inset-0 z-30 cursor-default" />
              <ul role="menu" className="absolute left-0 top-full z-40 mt-2 max-h-80 w-52 overflow-y-auto overscroll-contain rounded-3xl bg-white p-1.5 shadow-[0_14px_36px_-8px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.12)] dark:bg-neutral-900">
                {VENUE_TYPES.map((t) => (
                  <li key={t.id} role="none">
                    <button type="button" role="menuitemradio" aria-checked={shownType === t.id} onClick={() => { set("venueType", t.id); setTypeMenu(false); }} className={`press flex w-full items-center gap-3 px-3 py-3 text-left text-base ${shownType === t.id ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white"><Icon name={t.icon} size={18} /></span>
                      <span className="flex-1">{t.label}</span>
                      {shownType === t.id && <Icon name="check" size={18} />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {suggestionList("location")}
      {/* Always shown under the venue: a venue is its name and its address together, which is how two homes stay apart. */}
      <Labeled label="Address">
        <input className={field} data-venue-suggest placeholder="Street address" value={draft.address} onKeyDown={keepAsTyped} onChange={(e) => typeVenue("address", e.target.value)} />
      </Labeled>
      {suggestionList("address")}

      {/* Each on its own row: a phone draws date fields wider than their box and they overlapped the rating. */}
      <Labeled label="When">
        <select className={field} value={shownWhen} onChange={(e) => {
          const next = e.target.value as "day" | "month" | "year" | "none";
          setWhen(next);
          // Keep what is already known: the year of a full date stays when switching to month or year.
          const keep = draft.date.slice(0, next === "year" ? 4 : next === "month" ? 7 : 10);
          set("date", next === "none" ? "" : keep.length === (next === "year" ? 4 : next === "month" ? 7 : 10) ? keep : "");
        }}>
          <option value="day">Exact date</option>
          <option value="month">Month and year</option>
          <option value="year">Year only</option>
          <option value="none">I don&apos;t remember</option>
        </select>
      </Labeled>
      {/* A phone shows no hint text inside a date field, so each one has its name written above it. */}
      {shownWhen === "day" && <Labeled label="Date" plain><DateField label="Date" value={draft.date} onChange={(v) => set("date", v)} /></Labeled>}
      {shownWhen === "month" && <Labeled label="Month and year" plain><DateField type="month" label="Month and year" value={draft.date} onChange={(v) => set("date", v)} /></Labeled>}
      {shownWhen === "year" && (
        <Labeled label="Year">
          <select className={field} aria-label="Year" value={draft.date} onChange={(e) => set("date", e.target.value)}>
            <option value="">Choose a year</option>
            {yearChoices().map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </Labeled>
      )}
      {/* The time of day goes right after the date, since the two belong together. */}
      {shownWhen !== "none" && (
        <Labeled label="Time">
          <input className={field} placeholder="Time, such as 7:30 PM" value={draft.time} onChange={(e) => set("time", e.target.value)} />
        </Labeled>
      )}
      <Labeled label="Rating">
        <RatingSlider value={draft.rating === "" ? null : Number(draft.rating)} onChange={(v) => set("rating", v === null ? "" : String(v))} />
      </Labeled>

      <Labeled label="Format">
        <select className={field} value={draft.primaryFormat ?? ""} onChange={(e) => set("primaryFormat", e.target.value === "" ? null : (e.target.value as PrimaryFormat))}>
          {/* Left empty unless a format is chosen or a ticket shows one. */}
          <option value="">Choose a format</option>
          {FORMATS_SORTED.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Labeled>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="self-start px-1 text-sm text-neutral-500">
        {more ? "Fewer details" : "More details"}
      </button>

      {more && (
        <>
          <Labeled label="Screen or hall">
            <input className={field} placeholder="Screen or hall, such as Screen 4" value={draft.auditorium} onChange={(e) => void typeScreen(e.target.value)} />
          </Labeled>
          <Labeled label="Tickets">
            <input className={field} inputMode="numeric" placeholder="How many tickets" value={draft.totalTickets} onChange={(e) => set("totalTickets", e.target.value)} />
          </Labeled>
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
            <textarea className={AREA} rows={3} placeholder="Anything you want to remember about it" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Labeled>
        </>
      )}
    </fieldset>
  );
}
