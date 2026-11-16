// components/SuggestTags.tsx
// A list of chosen values shown as removable tags, with suggestions under the box as you type. Enter adds the top
// suggestion and tapping one adds that one. Fixed lists (countries, genres) filter as you type; others (people, themes)
// are asked for from a search once a couple of letters are in.
"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { normalize } from "@/lib/domain/search";
import { FIELD_SM as FIELD } from "@/components/ui/fields";

export interface TagItem {
  id: string;
  label: string;
  /** A TMDB image path, such as a person's photo. */
  image?: string | null;
  /** A small line under the name, such as what a person is known for. */
  note?: string | null;
  /** Other words that should find this one ("german" for Germany). */
  alias?: string;
}

interface Props {
  label: string;
  tags: TagItem[];
  /** A fixed list to filter as you type. */
  options?: TagItem[];
  /** Asked for suggestions once at least two letters are typed. */
  search?: (text: string) => Promise<TagItem[]>;
  /** Enter with nothing suggested adds the typed words as they are (themes, which have no fixed list). */
  allowFree?: boolean;
  onAdd: (item: TagItem) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
}

const SHOWN = 8;
const PAUSE_MS = 300;

function Face({ image, size }: { image: string | null | undefined; size: number }) {
  const src = tmdbImageUrl(image ?? null, "w185");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-neutral-300 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"><Icon name="user" size={Math.round(size * 0.55)} /></span>
  );
}

export default function SuggestTags({ label, tags, options, search, allowFree, onAdd, onRemove, placeholder }: Props) {
  const [text, setText] = useState("");
  const [remote, setRemote] = useState<{ for: string; items: TagItem[] }>({ for: "", items: [] });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const taken = new Set(tags.map((t) => t.id));
  const needle = normalize(text);

  let suggestions: TagItem[] = [];
  if (options && needle) {
    const matches = options.filter((o) => !taken.has(o.id) && normalize(`${o.label} ${o.alias ?? ""}`).includes(needle));
    // Names that start with what was typed come before names that only contain it.
    suggestions = [...matches.filter((o) => normalize(o.label).startsWith(needle) || normalize(o.alias ?? "").startsWith(needle)), ...matches.filter((o) => !(normalize(o.label).startsWith(needle) || normalize(o.alias ?? "").startsWith(needle)))];
  } else if (search && remote.for === text.trim()) {
    suggestions = remote.items.filter((o) => !taken.has(o.id));
  }
  suggestions = suggestions.slice(0, SHOWN);

  function onType(value: string) {
    setText(value);
    if (!search) return;
    clearTimeout(timer.current);
    const asked = value.trim();
    if (asked.length < 2) {
      setRemote({ for: "", items: [] });
      return;
    }
    timer.current = setTimeout(async () => {
      const items = await search(asked);
      setRemote({ for: asked, items });
    }, PAUSE_MS);
  }

  function add(item: TagItem) {
    onAdd(item);
    setText("");
    setRemote({ for: "", items: [] });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs text-neutral-500">{label}</span>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 rounded-full bg-neutral-950 py-1 pl-1.5 pr-1 text-white dark:bg-white dark:text-neutral-950">
              {t.image !== undefined && <Face image={t.image} size={20} />}
              <span className="pl-1.5">{t.label}</span>
              <button type="button" aria-label={`Remove ${t.label}`} onClick={() => onRemove(t.id)} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/15"><Icon name="close" size={11} /></button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={text}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          // Enter must not submit the page's own form.
          if (e.key === "Enter") {
            e.preventDefault();
            if (suggestions[0]) add(suggestions[0]);
            else if (allowFree && text.trim().length >= 2 && !taken.has(text.trim().toLowerCase())) add({ id: text.trim().toLowerCase(), label: text.trim() });
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="done"
        className={`${FIELD} w-full`}
      />
      {suggestions.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-neutral-100 text-sm dark:bg-neutral-800" aria-label={`${label} suggestions`}>
          {suggestions.map((s) => (
            <li key={s.id} className="border-t border-neutral-200 first:border-t-0 dark:border-neutral-700">
              <button type="button" onClick={() => add(s)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
                {s.image !== undefined && <Face image={s.image} size={36} />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{s.label}</span>
                  {s.note && <span className="truncate text-xs text-neutral-500">{s.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
