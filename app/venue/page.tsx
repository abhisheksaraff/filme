// app/venue/page.tsx
// A cinema, theatre or arena: where it is, and everything you have seen there.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import FlatMap from "@/components/FlatMap";
import OpenInMaps from "@/components/OpenInMaps";
import ViewingDetails from "@/components/ViewingDetails";
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
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-4 pt-6">
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {venue && (
        <div className="reveal flex flex-col gap-5">
          {point.length > 0 && <FlatMap points={point} className="h-56" />}
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-3xl tracking-tight">{venue.name}</h1>
            {venue.address ? (
              <OpenInMaps name={venue.name} address={[venue.address, venue.city, venue.country].filter(Boolean).join(", ")} latitude={venue.latitude} longitude={venue.longitude} />
            ) : (
              <p className="text-sm text-neutral-500">{[venue.city, venue.country].filter(Boolean).join(" · ") || venue.type}</p>
            )}
          </div>

          <h2 className="font-serif text-xl">{venue.viewings.length} {venue.viewings.length === 1 ? "visit" : "visits"}</h2>
          {/* Two to a row so each tile has room for its details; equal heights keep the grid tidy. */}
          <ul className="grid grid-cols-2 items-stretch gap-3">
            {venue.viewings.map((v) => (
              <li key={v.sessionId} className="flex">
                <Link href={`/title/?id=${v.mediaId}&v=${v.sessionId}`} className="flex w-full flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_16px_-6px_rgba(0,0,0,0.18)] dark:bg-neutral-900">
                  {v.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(v.posterPath, "w185") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
                  ) : (
                    <div className="aspect-[2/3] rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{v.title}</span>
                  <ViewingDetails compact auditorium={v.auditorium} seats={v.seats} totalTickets={v.totalTickets} format={v.primaryFormat} addons={v.addons} watchedOn={v.watchedOn} watchedAt={v.watchedAt} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
