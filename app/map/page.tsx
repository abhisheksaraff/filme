// app/map/page.tsx
// A full-screen map of every venue. Tap a pin for a sheet with the venue's address and everything you watched there.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePageState } from "@/lib/pageMemory";
import FlatMap, { KIND_ICON, type View } from "@/components/FlatMap";
import Icon from "@/components/Icon";
import OpenInMaps from "@/components/OpenInMaps";
import { LIST_SORTS, sortList, type ListSort } from "@/lib/domain/listSort";
import { formatScore } from "@/lib/domain/score";
import { placeQueries } from "@/lib/domain/venues";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { VenueDetail, VenuePoint } from "@/lib/ports/browse";
import { services } from "@/lib/services";

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
  // `venueType` is the kind of place of the pin that was tapped, so a hall used for a film and a concert opens on one or the other; null shows everything there.
  const [open, setOpen] = usePageState<{ point: VenuePoint; detail: VenueDetail | null; tab: string; venueType: string | null } | null>("map.open", null);
  // Where the map was left, so Back from another page returns to the same spot with the same pop-up open.
  const [view, setView] = usePageState<View | null>("map.view", null);
  const returning = useRef(view !== null || open !== null);
  const [sort, setSort] = usePageState<ListSort>("map.sort", "new");

  // Opened from the menu, the map starts where you are, a little zoomed out; without permission it frames all the pins.
  useEffect(() => {
    if (!ready || venueParam || returning.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setFocus({ lon: pos.coords.longitude, lat: pos.coords.latitude, zoom: 10 }),
      () => {},
      { timeout: 8000, maximumAge: 10 * 60_000 },
    );
  }, [ready, venueParam]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const first = await services.browse.venuePoints();
      if (cancelled) return;
      if (first.ok) {
        setPoints(first.value);
        const target = venueParam && !returning.current ? first.value.find((p) => p.id === venueParam) : undefined;
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
  // pick only sets state and loads the venue, so it is safe to leave out.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, venueParam]);

  function pick(point: VenuePoint, venueType: string | null) {
    setOpen({ point, detail: null, tab: "all", venueType });
    services.browse.venue(point.id).then((res) => {
      if (res.ok) setOpen((current) => (current?.point.id === point.id ? { ...current, detail: res.value } : current));
    });
  }

  const shown = useMemo(() => {
    const viewings = (open?.detail?.viewings ?? []).filter((v) => !open?.venueType || v.venueType === open.venueType);
    const list = open && open.tab !== "all" ? viewings.filter((v) => v.category === open.tab) : viewings;
    // Newest and oldest go by the day watched; the rest by IMDb score (TMDB's when there is none) or release date. Anything missing goes last.
    return sortList(list, sort, { date: (v) => v.watchedOn, score: (v) => v.publicScore, release: (v) => v.releaseDate });
  }, [open, sort]);

  if (!ready) return null;

  const counts = new Map<string, number>();
  const ofPin = (open?.detail?.viewings ?? []).filter((v) => !open?.venueType || v.venueType === open.venueType);
  for (const v of ofPin) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);

  return (
    <main className="fixed inset-0 z-10">
      <FlatMap points={points} onPick={pick} fullScreen focus={focus} initialView={view} onViewChange={setView} className="h-full" />
      {/* Same spot and size as the other pages' titles, just under the back button; no panel, only a shadow so it reads over the map. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.75rem)] z-20 wide:top-[max(0.75rem,env(safe-area-inset-top))] wide:flex wide:h-10 wide:items-center">
        <div className="mx-auto flex w-full max-w-md flex-col gap-1 px-6 md:max-w-3xl lg:max-w-5xl wide:flex-row wide:items-center wide:gap-3 wide:pl-[4.5rem]">
          <h1 className="font-serif text-3xl tracking-tight text-neutral-950 [text-shadow:0_1px_6px_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.25)] dark:text-white dark:[text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">Map</h1>
          {finding && <span className="px-1 text-xs text-neutral-800 [text-shadow:0_1px_4px_rgba(255,255,255,0.9)] dark:text-neutral-200 dark:[text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">Finding venues…</span>}
        </div>
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {/* A tap anywhere outside the pop-up closes it. */}
      {open && <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="absolute inset-0 z-30 cursor-default" />}

      {open && (
        // Tall, lifted clear of the bottom bar, with a soft shadow so it reads as the thing in front.
        <div className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex h-[60vh] w-auto max-w-md flex-col wide:h-[72vh] wide:max-w-3xl gap-3 overflow-y-auto rounded-[2.25rem] bg-white px-5 pb-6 pt-5 text-neutral-950 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5),0_6px_16px_rgba(0,0,0,0.25)] md:max-w-xl dark:bg-neutral-900 dark:text-white">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="font-serif text-2xl leading-tight tracking-tight">{open.point.name}</h2>
              {open.detail?.address ? (
                <OpenInMaps
                  name={open.point.name}
                  address={fullAddress(open.detail.address, open.detail.city)}
                  latitude={open.point.latitude}
                  longitude={open.point.longitude}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                />
              ) : open.detail ? (
                <p className="text-sm text-neutral-500">{[open.detail.city, open.detail.country].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-white/15"><Icon name="close" size={18} /></button>
          </div>
          {/* The kinds sit on the left, where the visit count used to be, and the sort menu on the right. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 gap-4 overflow-x-auto text-sm" role="tablist">
              {TABS.filter((t) => t.id === "all" || (counts.size > 1 && counts.has(t.id))).map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={open.tab === t.id} onClick={() => setOpen({ ...open, tab: t.id })}
                  className={`shrink-0 border-b-2 pb-1 ${open.tab === t.id ? "border-neutral-950 dark:border-white" : "border-transparent text-neutral-500"}`}>
                  {t.label} <span className="text-xs">{t.id === "all" ? (open.detail ? ofPin.length : (open.point.types.find((x) => x.category === open.venueType)?.count ?? open.point.count)) : counts.get(t.id)}</span>
                </button>
              ))}
            </div>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as ListSort)} className="shrink-0 rounded-full bg-neutral-200 px-3 py-1.5 text-sm outline-none dark:bg-white/15">
              {LIST_SORTS.map((s) => <option key={s.id} value={s.id} className="text-black">{s.label}</option>)}
            </select>
          </div>
          {!open.detail && <div className="skeleton h-40 rounded-2xl" />}
          <ul className="grid grid-cols-3 gap-3 wide:grid-cols-4">
            {shown.map((v) => (
              <li key={v.sessionId}>
                <Link href={`/title/?id=${v.mediaId}`} className="flex flex-col gap-1">
                  <span className="relative block">
                    {v.posterPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tmdbImageUrl(v.posterPath, "w185") ?? ""} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover shadow-[0_6px_14px_-4px_rgba(0,0,0,0.34),0_2px_5px_rgba(0,0,0,0.15)]" />
                    ) : (
                      <span className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-neutral-200 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.34),0_2px_5px_rgba(0,0,0,0.15)] dark:bg-white/15"><Icon name={KIND_ICON[v.category] ?? "film"} size={22} /></span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium leading-tight">{v.title}</span>
                  {(v.watchedOn || v.publicScore !== null) && (
                    <span className="text-[10px] text-neutral-500/80">{[v.watchedOn, v.publicScore !== null ? `★ ${formatScore(v.publicScore)}` : null].filter(Boolean).join(" · ")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

/** The street address, adding the city only when the address does not already name it; the country is left off. */
function fullAddress(address: string, city: string | null): string {
  return city && !address.toLowerCase().includes(city.toLowerCase()) ? `${address}, ${city}` : address;
}

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
