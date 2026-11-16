// components/TagInput.tsx
// A list of values shown as removable bubbles. With `options` it is a pick-list; without, free text.
"use client";

import { FIELD_FULL } from "@/components/ui/fields";
import { useState } from "react";

interface Props {
  label: string;
  tags: string[];
  /** Receives everything typed at once, so several values land in one update. */
  onAdd: (texts: string[]) => void;
  onRemove: (index: number) => void;
  /** When given, only these can be added, and they appear as tappable bubbles below the box. */
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

const bubble = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm";

export default function TagInput({ label, tags, onAdd, onRemove, options, placeholder, hint, disabled }: Props) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const available = (options ?? []).filter((o) => !tags.includes(o) && o.toLowerCase().includes(needle));

  function commit() {
    if (options) {
      if (available[0]) onAdd([available[0]]);
    } else {
      // A comma separates several values typed at once.
      const texts = query.split(",").map((t) => t.trim()).filter(Boolean);
      if (texts.length > 0) onAdd(texts);
    }
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs text-neutral-500">{label}</span>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className={`${bubble} bg-neutral-900 text-white dark:bg-white dark:text-neutral-900`}>
              {tag}
              <button type="button" disabled={disabled} aria-label={`Remove ${tag}`} onClick={() => onRemove(index)}>✕</button>
            </span>
          ))}
        </div>
      )}

      <input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter must not submit the whole form.
          if (e.key === "Enter" || (!options && e.key === ",")) {
            e.preventDefault();
            commit();
          }
        }}
        className={FIELD_FULL}
      />
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}

      {options && (
        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
          {available.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onAdd([option])}
              className={`${bubble} bg-neutral-100 dark:bg-neutral-800`}
            >
              {option}
            </button>
          ))}
          {available.length === 0 && <span className="text-sm text-neutral-500">No more matches.</span>}
        </div>
      )}
    </div>
  );
}
