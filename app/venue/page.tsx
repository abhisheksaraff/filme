// app/venue/page.tsx
// A cinema, theatre or arena: where it is, and everything you have seen there.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { VenueDetail } from "@/lib/ports/browse";
import { services } from "@/lib/services";

function VenueView() {
  const ready = useRequireSession();
  const id = useSearchParams().get("id");
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    services.browse.venue(id).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) return setProblem(res.error);
      setVenue(res.value);
      // A venue with no position yet is looked up once, then remembered.
      const v = res.value;
      if (v.latitude === null && v.type !== "home") {
        const found = await services.geo.locate([v.name, v.address ?? v.city].filter(Boolean).join(", "));
        if (!cancelled && found.ok && found.value) {
          await services.browse.setVenueLocation(v.id, found.value);
          setReload((n) => (n === 0 ? 1 : n));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);

  if (!ready) return null;
  if (!id) return <main className="p-6 text-sm">No venue selected.</main>;

  const { latitude, longitude } = venue ?? { latitude: null, longitude: null };
  const bbox = latitude !== null && longitude !== null ? `${longitude - 0.01},${latitude - 0.006},${longitude + 0.01},${latitude + 0.006}` : null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-24 pt-6">
      <BackLink />
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {venue && (
        <>
          <div>
            <h1 className="font-serif text-3xl tracking-tight">{venue.name}</h1>
            <p className="text-sm text-neutral-500">{[venue.address, venue.city, venue.country].filter(Boolean).join(" · ") || venue.type}</p>
          </div>
          {bbox && (
            <iframe
              title={`Map of ${venue.name}`}
              className="h-56 w-full rounded-2xl border-0"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
            />
          )}
          <Link href="/globe/" className="self-start rounded-full border border-neutral-400 px-4 py-1.5 text-sm">See all your venues on the globe</Link>

          <h2 className="font-serif text-xl">{venue.viewings.length} {venue.viewings.length === 1 ? "visit" : "visits"}</h2>
          <ul className="grid grid-cols-3 gap-3">
            {venue.viewings.map((v) => (
              <li key={v.sessionId}>
                <Link href={`/session/?id=${v.sessionId}`} className="flex flex-col gap-1 text-xs">
                  {v.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(v.posterPath, "w185") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
                  ) : (
                    <div className="aspect-[2/3] rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="line-clamp-2 font-medium">{v.title}</span>
                  <span className="text-neutral-500">{v.watchedOn ?? ""}{v.rating !== null ? ` · ★ ${v.rating}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

export default function VenuePage() {
  return (
    <Suspense>
      <VenueView />
    </Suspense>
  );
}
