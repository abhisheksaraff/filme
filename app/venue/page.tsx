// app/venue/page.tsx
// A cinema, theatre or arena: where it is, and everything you have seen there.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import FlatMap from "@/components/FlatMap";
import Icon from "@/components/Icon";
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
      if (v.latitude === null && !(v.type === "home" && !v.address)) {
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

  const point = venue && venue.latitude !== null && venue.longitude !== null ? [{
    id: venue.id, name: venue.name, type: venue.type, city: venue.city, country: venue.country,
    latitude: venue.latitude, longitude: venue.longitude, count: venue.viewings.length,
    kinds: [...venue.viewings.reduce((m, v) => m.set(v.category, (m.get(v.category) ?? 0) + 1), new Map<string, number>())].map(([category, count]) => ({ category, count })),
  }] : [];

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-24 pt-6">
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      {venue && (
        <>
          <div>
            <h1 className="font-serif text-3xl tracking-tight">{venue.name}</h1>
            <p className="text-sm text-neutral-500">{[venue.address, venue.city, venue.country].filter(Boolean).join(" · ") || venue.type}</p>
          </div>
          {point.length > 0 && <FlatMap points={point} className="h-56" />}
          <Link href="/map/" className="flex items-center gap-2 self-start rounded-full bg-neutral-950 px-4 py-2 text-sm text-white dark:bg-white dark:text-neutral-950">
            <Icon name="map" size={16} /> All venues
          </Link>

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
