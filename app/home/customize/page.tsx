// app/home/customize/page.tsx
// Choose which rows Home shows and in what order.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { arrangeHomeRows, resolveHomeRows, type HomeRowState } from "@/lib/domain/home";
import { services } from "@/lib/services";

const small = "rounded-lg border border-neutral-300 px-2 py-1 text-sm disabled:opacity-30 dark:border-neutral-700";

export default function CustomizeHomePage() {
  const ready = useRequireSession();
  const router = useRouter();
  const [rows, setRows] = useState<HomeRowState[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.settings.homeRows().then((res) => {
      if (cancelled) return;
      if (!res.ok) setProblem(res.error);
      setRows(arrangeHomeRows(resolveHomeRows(res.ok ? res.value : [])));
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /** Moves a row up or down; only the switched-on rows are saved, in this order. */
  function move(index: number, by: -1 | 1) {
    setRows((current) => {
      if (!current) return current;
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  function toggle(index: number) {
    setRows((current) => current && current.map((row, i) => (i === index ? { ...row, on: !row.on } : row)));
  }

  async function save() {
    if (!rows) return;
    const ids = rows.filter((row) => row.on).map((row) => row.id);
    if (ids.length === 0) {
      setProblem("Keep at least one row switched on.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const res = await services.settings.saveHomeRows(ids);
    if (!res.ok) {
      setProblem(res.error);
      setBusy(false);
      return;
    }
    router.replace("/home/");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <h1 className="font-serif text-3xl tracking-tight">Customize Home</h1>
      <p className="text-sm text-neutral-500">Switch rows on or off and use the arrows to change their order.</p>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <ul className="flex flex-col gap-2">
        {rows?.map((row, i) => (
          <li key={row.id} className="flex items-center gap-3">
            <input
              id={`row-${row.id}`}
              type="checkbox"
              checked={row.on}
              onChange={() => toggle(i)}
              className="h-5 w-5"
            />
            <label htmlFor={`row-${row.id}`} className="flex-1 text-base">{row.label}</label>
            <button type="button" aria-label={`Move ${row.label} up`} className={small} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" aria-label={`Move ${row.label} down`} className={small} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !rows}
          onClick={save}
          className="flex-1 rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRows(arrangeHomeRows(resolveHomeRows([])))}
          className="rounded-xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700"
        >
          Reset
        </button>
      </div>
    </main>
  );
}
