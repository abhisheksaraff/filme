// app/map/page.tsx
// A full-screen map of every venue. Tap a pin for a black sheet listing what you watched there.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePageState } from "@/lib/pageMemory";
import FlatMap, { KIND_ICON } from "@/components/FlatMap";
import Icon, { type IconName } from "@/components/Icon";
import { useRequireSession } from "@/hooks/useRequireSession";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";
import type { VenueDetail, VenuePoint } from "@/lib/ports/browse";
import { services } from "@/lib/services";

type Sort = "new" | "old" | "high" | "low";
const SORTS: { id: Sort; icon: IconName; label: string }[] = [
  { id: "new", icon: "sortNew", label: "Newest first" },
  { id: "old", icon: "sortOld", label: "Oldest first" },
  { id: "high", icon: "sortHigh", label: "Highest rated" },
  { id: "low", icon: "sortLow", label: "Lowest rated" },
];
const TABS: { id: string; icon: IconName; label: string }[] = [
  { id: "all", icon: "layers", label: "All" },
  { id: "Movie", icon: "film", label: "Movies" },
  { id: "TV Show", icon: "tv", label: "TV shows" },
  { id: "Concert", icon: "mic", label: "Concerts" },
  { id: "Live Event", icon: "masks", label: "Live events" },
];

/** A round control for the black sheet: white when selected, translucent otherwise. */
function Chip({ icon, label, on, onClick, count }: { icon: IconName; label: string; on?: boolean; onClick: () => void; count?: number }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-white/15 text-white"}`}>
      <Icon name={icon} size={18} />
      {count !== undefined && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-black ring-1 ring-black">{count}</span>}
    </button>
  );
}

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
        const found = await services.geo.locate([venue.name, venue.address].filter(Boolean).join(", "));
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
    const rate = (r: number | null, missing: number) => r ?? missing;
    return [...list].sort((a, b) =>
      sort === "old" ? (a.watchedOn ?? "").localeCompare(b.watchedOn ?? "")
      : sort === "high" ? rate(b.rating, -1) - rate(a.rating, -1)
      : sort === "low" ? rate(a.rating, 11) - rate(b.rating, 11)
      : (b.watchedOn ?? "").localeCompare(a.watchedOn ?? ""));
  }, [open, sort]);

  if (!ready) return null;

  const counts = new Map<string, number>();
  for (const v of open?.detail?.viewings ?? []) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);

  return (
    <main className="fixed inset-0 z-10">
      <FlatMap points={points} onPick={pick} fullScreen focus={focus} className="h-full" />
      {/* Sits beside the back button, which Shell floats at the top left of the column. */}
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20">
        <div className="mx-auto flex h-10 w-full max-w-md items-center gap-3 pl-[4.25rem] pr-4">
          <h1 className="rounded-full bg-white/85 px-4 py-1.5 font-serif text-xl leading-tight tracking-tight text-neutral-950 shadow backdrop-blur dark:bg-black/70 dark:text-white">Map</h1>
          {finding && <span className="rounded-full bg-white/85 px-3 py-1 text-xs text-neutral-700 shadow backdrop-blur dark:bg-black/70 dark:text-neutral-300">Finding venues…</span>}
        </div>
      </div>
      {problem && <p role="alert" className="absolute inset-x-6 top-20 z-20 rounded-2xl bg-white/90 px-3 py-2 text-sm text-red-600 dark:bg-black/70">{problem}</p>}

      {open && (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-h-[60vh] w-auto max-w-md flex-col gap-4 overflow-y-auto rounded-3xl bg-black px-5 pb-6 pt-5 text-white shadow-2xl">
          <div className="flex items-center gap-3">
            <Chip icon="close" label="Close" onClick={() => setOpen(null)} />
            <Link href={`/venue/?id=${open.point.id}`} className="min-w-0 flex-1 truncate font-serif text-xl">{open.point.name}</Link>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {TABS.filter((t) => t.id === "all" || counts.has(t.id)).map((t) => (
                <Chip key={t.id} icon={t.icon} label={t.label} on={open.tab === t.id} count={t.id === "all" ? open.detail?.viewings.length : counts.get(t.id)} onClick={() => setOpen({ ...open, tab: t.id })} />
              ))}
            </div>
            <div className="flex gap-2">
              {SORTS.map((s) => <Chip key={s.id} icon={s.icon} label={s.label} on={sort === s.id} onClick={() => setSort(s.id)} />)}
            </div>
          </div>
          {!open.detail && <div className="skeleton h-40 rounded-2xl" />}
          <ul className="grid grid-cols-3 gap-3">
            {shown.map((v) => (
              <li key={v.sessionId}>
                <Link href={`/session/?id=${v.sessionId}`} className="relative block">
                  {v.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImageUrl(v.posterPath, "w185") ?? ""} alt={v.title} loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover" />
                  ) : (
                    <span className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-white/15"><Icon name={KIND_ICON[v.category] ?? "film"} size={22} /></span>
                  )}
                  {v.rating !== null && <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 text-[11px]">★ {v.rating}</span>}
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
