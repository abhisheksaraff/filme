// app/person/page.tsx
// A cast or crew member: what you have seen them in, and what else they have done.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { previewHref } from "@/lib/home/rows";
import type { PersonDetail } from "@/lib/ports/browse";
import type { CatalogPerson } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

function PersonView() {
  const ready = useRequireSession();
  const id = useSearchParams().get("id");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [other, setOther] = useState<CatalogPerson | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.browse.person(id).then((res) => {
      if (cancelled) return;
      if (!res.ok) return setProblem(res.error);
      setPerson(res.value);
      if (res.value.tmdbId !== null) {
        services.catalog.person(res.value.tmdbId).then((c) => !cancelled && c.ok && setOther(c.value));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No person selected.</main>;

  const seen = person?.works.filter((w) => w.seen) ?? [];
  const logged = new Set(person?.works.map((w) => w.title));
  const more = (other?.works ?? []).filter((w) => !logged.has(w.title)).slice(0, 24);
  const picture = tmdbImageUrl(person?.profilePath, "w342") ?? other?.profileUrl ?? null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-24 pt-6">
      <BackLink />
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {person && (
        <>
          <div className="flex items-center gap-4">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picture} alt="" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-200 text-2xl dark:bg-neutral-800">{person.name[0]}</span>
            )}
            <h1 className="font-serif text-3xl tracking-tight">{person.name}</h1>
          </div>
          {other?.biography && <p className="line-clamp-6 text-sm text-neutral-600 dark:text-neutral-400">{other.biography}</p>}

          <h2 className="font-serif text-xl">In your log ({seen.length})</h2>
          {seen.length === 0 && <p className="text-sm text-neutral-500">Nothing you have watched lists them yet.</p>}
          <ul className="grid grid-cols-2 gap-4">
            {seen.map((w) => (
              <li key={w.mediaId}>
                <Link href={`/title/?id=${w.mediaId}`} className="flex flex-col gap-1">
                  {w.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(w.posterPath, "w342") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="aspect-[2/3] rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="font-serif text-base leading-tight">{w.title}</span>
                  <span className="text-xs capitalize text-neutral-500">{[...new Set(w.roles)].join(", ")}{w.year ? ` · ${w.year}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>

          {more.length > 0 && (
            <>
              <h2 className="font-serif text-xl">More from {person.name}</h2>
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
                {more.map((hit) => (
                  <li key={`${hit.kind}-${hit.tmdbId}`} className="w-28 shrink-0">
                    <Link href={previewHref(hit.kind, hit.tmdbId)} className="flex flex-col gap-1">
                      {hit.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={hit.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
                      ) : (
                        <div className="aspect-[2/3] rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                      )}
                      <span className="line-clamp-2 text-xs font-medium">{hit.title}</span>
                      {hit.year && <span className="text-xs text-neutral-500">{hit.year}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function PersonPage() {
  return (
    <Suspense>
      <PersonView />
    </Suspense>
  );
}
