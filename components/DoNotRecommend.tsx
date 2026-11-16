// components/DoNotRecommend.tsx
// A toggle on a movie or show page that keeps the title out of Home's recommendations; it shows its state every time the page opens.
"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { clearHomeCache } from "@/lib/home/rows";
import type { HiddenTitle } from "@/lib/ports/hidden";
import { services } from "@/lib/services";

export default function DoNotRecommend({ title }: { title: HiddenTitle }) {
  // null until the list arrives, so the pill never flashes the wrong state.
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const { category, tmdbId } = title;

  useEffect(() => {
    let cancelled = false;
    services.hidden.list().then((res) => !cancelled && res.ok && setOn(res.value.some((t) => t.category === category && t.tmdbId === tmdbId)));
    return () => {
      cancelled = true;
    };
  }, [category, tmdbId]);

  async function toggle() {
    if (on === null) return;
    const next = !on;
    setBusy(true);
    setOn(next);
    const res = next ? await services.hidden.hide(title) : await services.hidden.restore(category, tmdbId);
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      return toast(res.error);
    }
    // Rows already built for Home are rebuilt with or without it the next time Home opens.
    clearHomeCache();
  }

  if (on === null) return null;
  return (
    <button type="button" aria-pressed={on} disabled={busy} onClick={() => void toggle()}
      className={`flex items-center justify-between gap-3 rounded-full px-5 py-3 text-sm transition-colors ${on ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
      <span>Do not recommend</span>
      {on && <Icon name="check" size={18} />}
    </button>
  );
}
