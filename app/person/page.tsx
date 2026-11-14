// app/person/page.tsx
// A cast or crew member: what you have seen them in, and what else they have done.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import { previewHref } from "@/lib/home/rows";
import type { PersonDetail } from "@/lib/ports/browse";
import type { CatalogPerson } from "@/lib/ports/catalog";
import { services } from "@/lib/services";

function PersonView() {
  const ready = useRequireSession();
  const params = useSearchParams();
  const id = params.get("id");
  // A person only the catalogue knows (not saved yet) is opened by their TMDB id.
  const tmdbParam = Number(params.get("tmdb")) || null;
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [other, setOther] = useState<CatalogPerson | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || (!id && !tmdbParam)) return;
    let cancelled = false;
    (async () => {
      let personId = id;
      if (!personId && tmdbParam) {
        const found = await services.browse.personIdByTmdb(tmdbParam);
        if (cancelled) return;
        if (!found.ok) return setProblem(found.error);
        personId = found.value;
      }
      if (personId) {
        const res = await services.browse.person(personId);
        if (cancelled) return;
        if (!res.ok) return setProblem(res.error);
        setPerson(res.value);
        if (res.value.tmdbId !== null) {
          services.catalog.person(res.value.tmdbId).then((c) => !cancelled && c.ok && setOther(c.value));
        }
      } else if (tmdbParam) {
        const c = await services.catalog.person(tmdbParam);
        if (cancelled) return;
        if (!c.ok) return setProblem(c.error);
        setOther(c.value);
        setPerson({ id: "", tmdbId: tmdbParam, name: c.value.name, profilePath: null, works: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, tmdbParam]);

  if (!ready) return null;
  if (!id && !tmdbParam) return <main className="p-6 text-sm">No person selected.</main>;

  const seen = person?.works.filter((w) => w.seen) ?? [];
  const logged = new Set(person?.works.map((w) => w.title));
  const more = (other?.works ?? []).filter((w) => !logged.has(w.title)).slice(0, 24);
  const picture = tmdbImageUrl(person?.profilePath, "w342") ?? other?.profileUrl ?? null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-4 pt-6">
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {person && (
        <>
          <div className="flex items-center gap-4">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picture} alt="" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name="user" size={40} /></span>
            )}
            <h1 className="font-serif text-3xl tracking-tight">{person.name}</h1>
          </div>
          {other?.biography && <p className="line-clamp-6 text-sm text-neutral-600 dark:text-neutral-400">{other.biography}</p>}

          {person.id !== "" && <h2 className="font-serif text-xl">In your log ({seen.length})</h2>}
          {person.id !== "" && seen.length === 0 && <p className="text-sm text-neutral-500">Nothing you have watched lists them yet.</p>}
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
