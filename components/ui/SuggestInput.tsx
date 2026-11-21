// components/ui/SuggestInput.tsx
// A single-value text box with suggestions under it: they show as soon as the box is tapped, narrow as you type, fill the box when tapped,
// and go away on a tap outside (the typed text stays). Suggestions come from a fixed list or from a search that is asked on every change.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ClearX from "@/components/ui/ClearX";
import { FIELD_SM } from "@/components/ui/fields";
import SuggestionList, { SuggestionItem } from "@/components/ui/SuggestionList";
import { useOutsideClose } from "@/components/ui/useOutsideClose";
import { normalize } from "@/lib/domain/search";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  /** A fixed list, filtered as you type. */
  options?: readonly string[];
  /** Or a search, asked with whatever is typed (empty when just tapped). */
  search?: (text: string) => Promise<string[]>;
  className?: string;
}

export default function SuggestInput({ value, onChange, label, placeholder, options, search, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(box, open, close);

  useEffect(() => {
    if (!open || !search) return;
    let stale = false;
    const t = setTimeout(async () => {
      const r = await search(value.trim());
      if (!stale) setFound(r);
    }, value.trim() ? 250 : 0);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, value, search]);

  const needle = normalize(value);
  const list = (options ? options.filter((o) => !needle || normalize(o).includes(needle)) : found).filter((o) => o !== value);

  return (
    <div ref={box} className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="relative min-w-0">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          className={`${FIELD_SM} w-full pr-11`}
        />
        {value && <ClearX label={label} onClear={() => onChange("")} />}
      </div>
      {open && list.length > 0 && (
        <SuggestionList label={`${label} suggestions`} scroll>
          {list.map((o) => (
            <SuggestionItem key={o}>
              <button type="button" onClick={() => { onChange(o); setOpen(false); }} className="press flex w-full px-3 py-2 text-left"><span className="truncate">{o}</span></button>
            </SuggestionItem>
          ))}
        </SuggestionList>
      )}
    </div>
  );
}
