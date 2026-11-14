// app/collections/page.tsx
// The user's own lists of titles, and a form to start a new one.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { CollectionSummary } from "@/lib/ports/collections";
import { services } from "@/lib/services";

export default function CollectionsPage() {
  const ready = useRequireSession();
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.collections.list().then((res) => {
      if (cancelled) return;
      if (res.ok) setCollections(res.value);
      else setProblem(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setProblem(null);
    const res = await services.collections.create(name, null);
    if (!res.ok) {
      setProblem(res.error);
      setBusy(false);
      return;
    }
    router.push(`/collection/?id=${res.value}`);
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-8">
      <h1 className="font-serif text-3xl tracking-tight">Collections</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection, e.g. Rainy Sundays"
          maxLength={80}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Create
        </button>
      </form>

      {!collections && !problem && <p className="text-sm text-neutral-500">Loading…</p>}
      {collections?.length === 0 && <p className="text-sm text-neutral-500">No collections yet.</p>}

      <ul className="flex flex-col gap-3">
        {collections?.map((collection) => (
          <li key={collection.id}>
            <Link href={`/collection/?id=${collection.id}`} className="flex items-center gap-3 rounded-xl border border-neutral-300 p-3 dark:border-neutral-700">
              <div className="flex w-20 shrink-0 -space-x-6">
                {collection.posterPaths.length === 0 && <div className="h-16 w-11 rounded bg-neutral-200 dark:bg-neutral-800" />}
                {collection.posterPaths.map((path) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={path} src={tmdbImageUrl(path, "w185") ?? ""} alt="" className="h-16 w-11 rounded border border-white object-cover dark:border-neutral-950" />
                ))}
              </div>
              <div className="flex flex-col text-sm">
                <span className="font-medium">{collection.name}</span>
                <span className="text-neutral-500">{collection.count} {collection.count === 1 ? "title" : "titles"}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
