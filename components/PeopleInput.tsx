// components/PeopleInput.tsx
// One row of people on a title (starring, director, ...), as removable bubbles in a single line that
// scrolls sideways. Suggests people from your own log first, then the catalogue; anyone else can still
// be added by name and gets the default person icon.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { StarringPick } from "@/lib/adapters/supabase/credits";
import { samePick } from "@/components/entryDraft";
import { services } from "@/lib/services";

interface Props {
  /** Shown above the row, such as "Director". */
  label: string;
  people: StarringPick[];
  onChange: (next: StarringPick[]) => void;
  disabled?: boolean;
}

interface Suggestion extends StarringPick {
  /** True for people already in the user's log. */
  own: boolean;
}

function Face({ path, size }: { path: string | null; size: number }) {
  const src = tmdbImageUrl(path, "w185");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
      <Icon name="user" size={Math.round(size * 0.55)} />
    </span>
  );
}

export default function PeopleInput({ label, people, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; items: Suggestion[] }>({ query: "", items: [] });
  // Names show in at most two rows; the rest open with "Show more".
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (el) setOverflows(el.scrollHeight > 72 + 1);
  }, [people]);

  // Looks a moment after typing stops: own history first, then everyone on TMDB.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const [own, tmdb] = await Promise.all([services.browse.searchPeople(text), services.catalog.searchPeople(text)]);
      if (stale) return;
      const mine: Suggestion[] = own.ok ? own.value.map((p) => ({ ...p, own: true })) : [];
      const known = new Set(mine.flatMap((p) => (p.tmdbId === null ? [] : [p.tmdbId])));
      const more: Suggestion[] = tmdb.ok
        ? tmdb.value.filter((p) => !known.has(p.tmdbId)).map((p) => ({ personId: null, tmdbId: p.tmdbId, name: p.name, profilePath: p.profilePath, own: false }))
        : [];
      setFound({ query: text, items: [...mine, ...more].filter((s) => !people.some((p) => samePick(p, s))) });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, people]);

  function add(pick: StarringPick) {
    if (!people.some((p) => samePick(p, pick))) onChange([...people, { personId: pick.personId, tmdbId: pick.tmdbId, name: pick.name, profilePath: pick.profilePath }]);
    setQuery("");
  }

  const text = query.trim();
  const items = text.length >= 2 && found.query === text ? found.items : [];
  const exact = items.find((s) => s.name.toLowerCase() === text.toLowerCase());

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs text-neutral-500">{label}</span>

      {people.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          <div ref={list} className="flex flex-wrap gap-2 overflow-hidden" style={expanded ? undefined : { maxHeight: 72 }}>
            {people.map((p, index) => (
              <span key={`${p.name}-${index}`} className={`inline-flex max-w-full items-center gap-2 rounded-full bg-neutral-900 py-1 pl-1 text-sm text-white dark:bg-white dark:text-neutral-900 ${p.fromMatch ? "pr-3" : "pr-2"}`}>
                <Face path={p.profilePath} size={24} />
                <span className="truncate">{p.name}</span>
                {/* Names that came with the title are fixed; only the ones added here can be taken out. */}
                {!p.fromMatch && <button type="button" disabled={disabled} aria-label={`Remove ${p.name} from ${label}`} onClick={() => onChange(people.filter((_, i) => i !== index))}>✕</button>}
              </span>
            ))}
          </div>
          {(overflows || expanded) && (
            <button type="button" onClick={() => setExpanded((o) => !o)} className="self-end px-1 text-sm text-neutral-500">{expanded ? "Show less" : "Show more"}</button>
          )}
        </div>
      )}

      <input
        value={query}
        disabled={disabled}
        placeholder={`Add to ${label.toLowerCase()}`}
        enterKeyHint="done"
        autoCorrect="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter must not submit the whole form.
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (!text) return;
          add(exact ?? { personId: null, tmdbId: null, name: text, profilePath: null });
        }}
        className="w-full rounded-2xl bg-neutral-100 px-4 py-3 text-base outline-none dark:bg-neutral-800"
      />

      {text.length >= 2 && (
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          {items.map((s) => (
            <li key={`${s.personId ?? "t"}-${s.tmdbId ?? s.name}`}>
              <button type="button" onClick={() => add(s)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
                <Face path={s.profilePath} size={32} />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-xs text-neutral-500">{s.own ? "In your log" : "TMDB"}</span>
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button type="button" onClick={() => add({ personId: null, tmdbId: null, name: text, profilePath: null })} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
                <Face path={null} size={32} />
                <span>Add “{text}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
