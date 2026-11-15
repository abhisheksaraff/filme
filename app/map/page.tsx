// app/map/page.tsx
// A full-screen map of every venue. Tap a pin for a sheet with the venue's address and everything you watched there.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePageState } from "@/lib/pageMemory";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon from "@/components/Icon";
import OpenInMaps from "@/components/OpenInMaps";
import { placeQueries } from "@/lib/domain/venues";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { VenueDetail, VenuePoint } from "@/lib/ports/browse";
import { services } from "@/lib/services";

type Sort = "new" | "old" | "high" | "low";
const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "old", label: "Oldest" },
  { id: "high", label: "Highest rated" },
  { id: "low", label: "Lowest rated" },
];
/** Text tabs; one only shows when something of that kind was seen at the venue. */
const TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Movie", label: "Movies" },
  { id: "TV Show", label: "TV shows" },
  { id: "Concert", label: "Concerts" },
  { id: "Live Event", label: "Live events" },
];

function MapView() {
  const ready = useRequireSession();
  // A link from a viewing names the venue to open on.
  const venueParam = useSearchParams().get("venue");
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom: number } | undefined>(undefined);
  const [points, setPoints] = useState<VenuePoint[]>([]);
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<{ point: VenuePoint; detail: VenueDetail | null; tab: string } | null>(null);
  const [sort, setSort] = usePageState<Sort>("map.sort", "new");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const first = await services.browse.venuePoints();
      if (cancelled) return;
      if (first.ok) {
        setPoints(first.value);
        const target = venueParam ? first.value.find((p) => p.id === venueParam) : undefined;
        if (target) {
          setFocus({ lon: target.longitude, lat: target.latitude, zoom: 15 });
          pick(target, null);
        }
      } else setProblem(first.error);

      // Venues without a position are looked up a few at a time, politely spaced out.
      const missing = await services.browse.unlocatedVenues(6);
      if (cancelled || !missing.ok || missing.value.length === 0) return;
      setFinding(true);
      for (const venue of missing.value) {
        const found = await services.geo.locate(placeQueries(venue.name, venue.address));
        if (cancelled) return;
        if (found.ok && found.value) await services.browse.setVenueLocation(venue.id, found.value);
      }
      const again = await services.browse.venuePoints();
      if (!cancelled && again.ok) setPoints(again.value);
      setFinding(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, venueParam]);

  function pick(point: VenuePoint, category: string | null) {
    setOpen({ point, detail: null, tab: category ?? "all" });
    services.browse.venue(point.id).then((res) => {
      if (res.ok) setOpen((current) => (current?.point.id === point.id ? { ...current, detail: res.value } : current));
    });
  }

  const shown = useMemo(() => {
    const viewings = open?.detail?.viewings ?? [];
    const list = open && open.tab !== "all" ? viewings.filter((v) => v.category === open.tab) : viewings;
    // Rated by the title's public score; titles without one go last either way, and ties fall back to newest first.
    const score = (v: { publicScore: number | null }, missing: number) => v.publicScore ?? missing;
    // Viewings with no date go last in either date order.
    const byDate = (a: string | null, b: string | null, dir: 1 | -1) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : dir * a.localeCompare(b));
    return [...list].sort((a, b) =>
      sort === "old" ? byDate(a.watchedOn, b.watchedOn, 1)
      : sort === "high" ? (score(b, -1) - score(a, -1) || byDate(a.watchedOn, b.watchedOn, -1))
      : sort === "low" ? (score(a, 11) - score(b, 11) || byDate(a.watchedOn, b.watchedOn, -1))
      : byDate(a.watchedOn, b.watchedOn, -1));
  }, [open, sort]);

  if (!ready) return null;

  const counts = new Map<string, number>();
  for (const v of open?.detail?.viewings ?? []) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);

  return (
    <main className="fixed inset-0 z-10">
      <FlatMap points={points} onPick={pick} fullScreen focus={focus} className="h-full" />
      {/* Same spot and size as the other pages' titles, just under the back button; no panel, only a shadow so it reads over the map. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.75rem)] z-20">
        <div className="mx-auto flex w-full max-w-md flex-col gap-1 px-4">
          <h1 className="px-1 font-serif text-3xl tracking-tight text-neutral-950 [text-shadow:0_1px_6px_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.25)] dark:text-white dark:[text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">Map</h1>
          {finding && <span className="px-1 text-xs text-neutral-800 [text-shadow:0_1px_4px_rgba(255,255,255,0.9)] dark:text-neutral-200 dark:[text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">Finding venues…</span>}
        </div>
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {open && (
        // Tall, lifted clear of the bottom bar, with a soft shadow so it reads as the thing in front.
        <div className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex h-[60vh] w-auto max-w-md flex-col gap-3 overflow-y-auto rounded-3xl bg-white px-5 pb-6 pt-5 text-neutral-950 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5),0_6px_16px_rgba(0,0,0,0.25)] md:max-w-xl dark:bg-neutral-900 dark:text-white">
          <div className="flex items-start gap-3">
            <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-white/15"><Icon name="close" size={18} /></button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="font-serif text-2xl leading-tight tracking-tight">{open.point.name}</h2>
              {open.detail?.address ? (
                <OpenInMaps
                  name={open.point.name}
                  address={[open.detail.address, open.detail.city, open.detail.country].filter(Boolean).join(", ")}
                  latitude={open.point.latitude}
                  longitude={open.point.longitude}
                />
              ) : open.detail ? (
                <p className="text-sm text-neutral-500">{[open.detail.city, open.detail.country].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
          </div>
          {/* The kinds sit on the left, where the visit count used to be, and the sort menu on the right. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 gap-4 overflow-x-auto text-sm" role="tablist">
              {TABS.filter((t) => t.id === "all" || (counts.size > 1 && counts.has(t.id))).map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={open.tab === t.id} onClick={() => setOpen({ ...open, tab: t.id })}
                  className={`shrink-0 border-b-2 pb-1 ${open.tab === t.id ? "border-neutral-950 dark:border-white" : "border-transparent text-neutral-500"}`}>
                  {t.label} <span className="text-xs">{t.id === "all" ? (open.detail?.viewings.length ?? open.point.count) : counts.get(t.id)}</span>
                </button>
              ))}
            </div>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="shrink-0 rounded-full bg-neutral-200 px-3 py-1.5 text-sm outline-none dark:bg-white/15">
              {SORTS.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}
            </select>
          </div>
          {!open.detail && <div className="skeleton h-40 rounded-2xl" />}
          <ul className="grid grid-cols-3 gap-3">
            {shown.map((v) => (
              <li key={v.sessionId}>
                <Link href={`/title/?id=${v.mediaId}`} className="flex flex-col gap-1">
                  <span className="relative block">
                    {v.posterPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tmdbImageUrl(v.posterPath, "w185") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
                    ) : (
                      <span className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-neutral-200 dark:bg-white/15"><Icon name={KIND_ICON[v.category] ?? "film"} size={22} /></span>
                    )}
                    {v.rating !== null && <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 text-[11px] text-white">★ {v.rating}</span>}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium leading-tight">{v.title}</span>
                  {v.watchedOn && <span className="text-[11px] text-neutral-500">{v.watchedOn}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
