// app/globe/page.tsx
// A spinning globe with a pin for every venue you have a position for. Drag to turn it.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { CONTINENTS } from "@/lib/globeData";
import type { VenuePoint } from "@/lib/ports/browse";
import { services } from "@/lib/services";

const RAD = Math.PI / 180;
const SIZE = 320;
const RADIUS = SIZE / 2 - 10;

/** Turns a longitude and latitude into screen coordinates, and whether the point faces us. */
function project(lon: number, lat: number, turn: number, tilt: number) {
  const λ = (lon + turn) * RAD;
  const φ = lat * RAD;
  const x = Math.cos(φ) * Math.sin(λ);
  const y = Math.sin(φ) * Math.cos(tilt) - Math.cos(φ) * Math.cos(λ) * Math.sin(tilt);
  const z = Math.sin(φ) * Math.sin(tilt) + Math.cos(φ) * Math.cos(λ) * Math.cos(tilt);
  return { x: SIZE / 2 + x * RADIUS, y: SIZE / 2 - y * RADIUS, front: z > 0 };
}

export default function GlobePage() {
  const ready = useRequireSession();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<VenuePoint[]>([]);
  const [selected, setSelected] = useState<VenuePoint | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const view = useRef({ turn: 0, tilt: 0.35, dragging: false, lastX: 0, lastY: 0, moved: 0 });
  const pointsRef = useRef<VenuePoint[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const first = await services.browse.venuePoints();
      if (cancelled) return;
      if (first.ok) {
        setPoints(first.value);
        pointsRef.current = first.value;
        if (first.value[0]) view.current.turn = -first.value[0].longitude;
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
      if (!cancelled && again.ok) {
        setPoints(again.value);
        pointsRef.current = again.value;
      }
      setFinding(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = SIZE * ratio;
    el.height = SIZE * ratio;
    ctx.scale(ratio, ratio);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = document.documentElement.classList.contains("dark");
    let frame = 0;

    const draw = () => {
      const v = view.current;
      if (!v.dragging && !reduce) v.turn += 0.15;
      ctx.clearRect(0, 0, SIZE, SIZE);

      const sea = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 10, SIZE / 2, SIZE / 2, RADIUS);
      sea.addColorStop(0, dark ? "#2b4a6b" : "#9cc8ee");
      sea.addColorStop(1, dark ? "#0f2236" : "#4c8bc4");
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = dark ? "#4d7a52" : "#7fb069";
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (const shape of CONTINENTS) {
        const projected = shape.map(([lon, lat]) => project(lon, lat, v.turn, v.tilt));
        if (!projected.some((p) => p.front)) continue;
        ctx.beginPath();
        let started = false;
        for (const p of projected) {
          if (!p.front) continue;
          if (started) ctx.lineTo(p.x, p.y);
          else {
            ctx.moveTo(p.x, p.y);
            started = true;
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      for (const venue of pointsRef.current) {
        const p = project(venue.longitude, venue.latitude, v.turn, v.tilt);
        if (!p.front) continue;
        ctx.fillStyle = "#ff3b30";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 + Math.min(5, venue.count), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  function onTap(clientX: number, clientY: number) {
    const el = canvas.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const v = view.current;
    let best: { venue: VenuePoint; d: number } | null = null;
    for (const venue of pointsRef.current) {
      const p = project(venue.longitude, venue.latitude, v.turn, v.tilt);
      if (!p.front) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 18 && (!best || d < best.d)) best = { venue, d };
    }
    setSelected(best?.venue ?? null);
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 pb-24 pt-6">
      <div className="self-start"><BackLink fallback="/stats/" /></div>
      <h1 className="font-serif text-3xl tracking-tight">Where you watched</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      <canvas
        ref={canvas}
        aria-label="A globe with a pin for each venue"
        style={{ width: SIZE, height: SIZE, touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          Object.assign(view.current, { dragging: true, lastX: e.clientX, lastY: e.clientY, moved: 0 });
        }}
        onPointerMove={(e) => {
          const v = view.current;
          if (!v.dragging) return;
          v.turn += (e.clientX - v.lastX) * 0.5;
          v.tilt = Math.max(-1.2, Math.min(1.2, v.tilt + (e.clientY - v.lastY) * 0.005));
          v.moved += Math.abs(e.clientX - v.lastX) + Math.abs(e.clientY - v.lastY);
          v.lastX = e.clientX;
          v.lastY = e.clientY;
        }}
        onPointerUp={(e) => {
          const v = view.current;
          v.dragging = false;
          if (v.moved < 6) onTap(e.clientX, e.clientY);
        }}
      />
      {finding && <p className="text-sm text-neutral-500">Finding more venues on the map…</p>}
      {selected && (
        <Link href={`/venue/?id=${selected.id}`} className="rounded-2xl bg-neutral-100 px-5 py-3 text-center text-sm dark:bg-neutral-900">
          <span className="block font-medium">{selected.name}</span>
          <span className="text-neutral-500">{[selected.city, selected.country].filter(Boolean).join(", ")} · {selected.count} {selected.count === 1 ? "visit" : "visits"}</span>
        </Link>
      )}
      {!selected && points.length === 0 && !problem && <p className="text-sm text-neutral-500">Pins appear once your venues have a position.</p>}
    </main>
  );
}
