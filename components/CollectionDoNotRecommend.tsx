// components/CollectionDoNotRecommend.tsx
// A toggle on a collection's page that keeps it out of Home's collection rows and Continue watching; it shows its state every time the page opens.
"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { clearHomeCache } from "@/lib/home/rows";
import { services } from "@/lib/services";

export default function CollectionDoNotRecommend({ collectionId }: { collectionId: number }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    services.passes.hiddenCollectionIds().then((res) => !cancelled && res.ok && setOn(res.value.has(collectionId)));
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  async function toggle() {
    if (on === null) return;
    const next = !on;
    setBusy(true);
    setOn(next);
    const res = await services.passes.setCollectionHidden(collectionId, next);
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      return toast(res.error);
    }
    clearHomeCache();
  }

  if (on === null) return null;
  return (
    <button type="button" aria-pressed={on} disabled={busy} onClick={() => void toggle()}
      className={`inline-flex w-fit items-center justify-center gap-2 self-center rounded-full px-6 py-2.5 text-center text-sm transition-colors ${on ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}>
      <span>Do not recommend</span>
      {on && <Icon name="check" size={18} />}
    </button>
  );
}
