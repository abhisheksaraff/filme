// app/rows/page.tsx
// Everything in one of Home's rows, as a grid that keeps loading more as you scroll. Back returns to Home as it was left.
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import PosterRow from "@/components/PosterRow";
import ProblemPopup from "@/components/ProblemPopup";
import { useRequireSession } from "@/hooks/useRequireSession";
import { loadMoreRow, loadRow, peekRow, type RowItem, type RowResult } from "@/lib/home/rows";

/** Pages tried in a row that bring nothing new (all seen or hidden) before the page stops asking. */
const EMPTY_PAGES = 3;

const withoutRepeats = (items: RowItem[]): RowItem[] => [...new Map(items.map((i) => [i.key, i])).values()];

function RowsView() {
  const ready = useRequireSession();
  const rowId = useSearchParams().get("id");
  const [row, setRow] = useState<RowResult | null>(null);
  const [items, setItems] = useState<RowItem[]>([]);
  const [page, setPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // The row as Home showed it (same title, same first posters); reopened after a restart it is built again.
  useEffect(() => {
    if (!ready || !rowId) return;
    let cancelled = false;
    const earlier = peekRow(rowId);
    (earlier ? Promise.resolve(earlier) : loadRow(rowId)).then((res) => {
      if (cancelled) return;
      if (!res.ok) return setProblem(res.error);
      setRow(res.value);
      setItems(withoutRepeats([...res.value.items, ...(res.value.rest ?? [])]));
      setPage(res.value.more ? res.value.more.page + 1 : null);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, rowId]);

  const more = useCallback(async () => {
    if (!row?.more || page === null || loading) return;
    setLoading(true);
    let at = page;
    for (let tries = 0; tries < EMPTY_PAGES; tries++, at++) {
      const res = await loadMoreRow({ spec: row.more.spec, page: at });
      if (!res.ok) {
        setProblem(res.error);
        setPage(null);
        setLoading(false);
        return;
      }
      // TMDB answers a page past its last with nothing at all: the list has run out.
      if (res.value.length > 0) {
        setItems((now) => withoutRepeats([...now, ...res.value]));
        setPage(at + 1);
        setLoading(false);
        return;
      }
    }
    setPage(null);
    setLoading(false);
  }, [row, page, loading]);

  useEffect(() => {
    const el = end.current;
    if (!el || page === null) return;
    const watcher = new IntersectionObserver((hits) => {
      if (hits.some((h) => h.isIntersecting)) void more();
    }, { rootMargin: "800px 0px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [more, page, items.length]);

  if (!ready) return null;
  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-4 px-3 pb-4 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl tracking-tight">{row?.title ?? ""}</h1>
        {row?.subtitle && <p className="text-sm text-neutral-500">{row.subtitle}</p>}
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {row && items.length > 0 && <PosterRow items={items} grid />}
      {row && items.length === 0 && <p className="text-neutral-500">{row.empty}</p>}
      <div ref={end} className="h-px" />
      {loading && <div className="skeleton h-24 rounded-2xl" />}
    </main>
  );
}

export default function RowsPage() {
  return (
    <Suspense fallback={null}>
      <RowsView />
    </Suspense>
  );
}
