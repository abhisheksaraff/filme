// components/decor/Scene.tsx
// The moving background of the active theme: snow, fireworks, lanterns, a night sky, balloons, or Halloween walkers.
// It is drawn behind the page, so text always reads over it. Taps on the page reach it through tap.ts: pieces pop,
// fireworks go off early (or fizzle and fall), creatures lunge. Only opacity and position are animated so it stays smooth on iPhone.
"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Accent, Balloon, Bat, Cloud, Dracula, Lantern, Monster, Moon, Petal, Sleigh, Snowflake, Star, Wolf } from "./art";
import { useDecorTap } from "./tap";
import { Bits, Piece } from "./Touchy";
import { useDecor } from "./useDecor";

/** Deterministic pseudo-random numbers, so a piece keeps its place between renders. */
const seeded = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Pieces that drift down (or up) the whole screen, each on its own timing so they never move in step. A tap pops one; it is back on its next pass. */
function Drifting({ count, direction, render, slow = 1, bits }: { count: number; direction: "down" | "up"; render: (i: number) => ReactNode; slow?: number; bits: readonly string[] }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Piece
          key={i}
          colors={bits}
          back="loop"
          className={direction === "down" ? "drift-down" : "drift-up"}
          style={{ left: `${seeded(i, 1) * 96}%`, animationDuration: `${(14 + seeded(i, 2) * 14) * slow}s`, animationDelay: `${-seeded(i, 3) * 28}s` }}
        >
          <span className="sway" style={{ animationDuration: `${3 + seeded(i, 4) * 3}s`, animationDelay: `${-seeded(i, 5) * 4}s` }}>
            {render(i)}
          </span>
        </Piece>
      ))}
    </>
  );
}

/**
 * Something that crosses the screen now and then, then waits a good while before coming back.
 * Tapped, it either pops into sprinkles (when `bits` is given) or hands the tap to its children to react to.
 */
function Crosser({ children, top, seconds, wait, first, bits, slop = 28 }: {
  children: ReactNode | ((tapped: boolean) => ReactNode);
  top: string;
  seconds: number;
  wait: [number, number];
  first: number;
  bits?: readonly string[];
  slop?: number;
}) {
  const [run, setRun] = useState<number | null>(null);
  const [tapped, setTapped] = useState(false);
  const spawned = useRef(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (run !== null) return;
    const timer = setTimeout(() => {
      spawned.current = true;
      setTapped(false);
      if (document.visibilityState === "visible") setRun(Date.now());
      else setRun(null);
    }, (spawned.current ? between(wait[0], wait[1]) : first) * 1000);
    return () => clearTimeout(timer);
  }, [run, wait, first]);

  useDecorTap(holder, () => setTapped(true), run !== null && !tapped);

  if (run === null) return null;
  const body = typeof children === "function" ? children(tapped) : children;
  return (
    <div key={run} ref={holder} data-slop={slop} className="cross" style={{ top, animationDuration: `${seconds}s` }} onAnimationEnd={() => setRun(null)}>
      {bits && typeof children !== "function" ? (
        <>
          <span className={`decor-piece block ${tapped ? "decor-gone" : ""}`}>{body}</span>
          {tapped && <Bits colors={bits} count={14} />}
        </>
      ) : body}
    </div>
  );
}

const GOLD = ["#ffd54a", "#ffe9a8", "#ff9bd0", "#9be7ff"];
const MULTI = ["#ffb300", "#ff5c5c", "#5cc8ff", "#62d26f", "#c58bff", "#ff8fb1"];
const RED = ["#e5322d", "#f4a3a1", "#ff7a76"];

/** The burst itself: sparks flying out in a ring. */
function Burst({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      {Array.from({ length: 18 }, (_, i) => (
        <i key={i} className="spark" style={{ "--a": `${i * 20}deg`, "--d": `${i % 2 ? 44 : 66}px`, background: color } as CSSProperties} />
      ))}
    </div>
  );
}

/**
 * One firework: a rocket climbs, then bursts. Tap the rocket while it climbs and it goes off at once; about one in
 * four is a dud that sputters, puffs smoke and falls back down.
 */
function Rocket({ x, y, color, onGone }: { x: number; y: number; color: string; onGone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"rise" | "burst" | "dud">("rise");
  const [at, setAt] = useState({ x, y });
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });

  useDecorTap(ref, () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setAt({ x: ((box.left + box.width / 2) / window.innerWidth) * 100, y: ((box.top + box.height / 2) / window.innerHeight) * 100 });
    setPhase(Math.random() < 0.25 ? "dud" : "burst");
  }, phase === "rise");

  useEffect(() => {
    if (phase === "rise") return;
    const timer = setTimeout(() => gone.current(), phase === "burst" ? 2200 : 1700);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "rise") {
    return <div ref={ref} data-slop={40} className="rocket" style={{ left: `${x}%`, top: `${y}%`, "--r": 100 - y, "--c": color } as CSSProperties} onAnimationEnd={() => setPhase("burst")} />;
  }
  if (phase === "burst") return <Burst x={at.x} y={at.y} color={color} />;
  const side = at.x > 50 ? -1 : 1;
  return (
    <div className="absolute" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <i className="dud" style={{ "--c": color, "--sx": `${side * 22}px`, "--rot": `${side * 50}deg` } as CSSProperties} />
      {[0, 1, 2].map((i) => <i key={i} className="puff" style={{ left: (i - 1) * 9, animationDelay: `${i * 0.12}s` }} />)}
      {Array.from({ length: 6 }, (_, i) => <i key={i} className="spark" style={{ "--a": `${i * 60 + 20}deg`, "--d": "16px", background: color } as CSSProperties} />)}
    </div>
  );
}

/** Small fireworks that open high up and fade, never more than a few at once. */
function Fireworks({ colors, gap }: { colors: readonly string[]; gap: [number, number] }) {
  const [rockets, setRockets] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  useEffect(() => {
    let next: ReturnType<typeof setTimeout>;
    const fire = () => {
      if (document.visibilityState === "visible") {
        const id = Date.now() + Math.random();
        setRockets((list) => [...list.slice(-2), { id, x: between(10, 90), y: between(8, 42), color: pick(colors) }]);
      }
      next = setTimeout(fire, between(gap[0], gap[1]) * 1000);
    };
    next = setTimeout(fire, 1200);
    return () => clearTimeout(next);
  }, [colors, gap]);

  return (
    <>
      {rockets.map((r) => (
        <Rocket key={r.id} x={r.x} y={r.y} color={r.color} onGone={() => setRockets((list) => list.filter((q) => q.id !== r.id))} />
      ))}
    </>
  );
}

const STAR_BITS = ["#fff3b0", "#ffd54a", "#ffffff"];
const LANTERN_BITS = ["#ffd54a", "#e23b2e", "#ff8a2a"];

function Night() {
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <Piece key={i} colors={STAR_BITS} back={9000} slop={12} className="twinkle absolute" style={{ left: `${seeded(i, 1) * 96}%`, top: `${seeded(i, 2) * 46}%`, animationDelay: `${seeded(i, 3) * 4}s` }}>
          <Star size={6 + Math.round(seeded(i, 4) * 6)} />
        </Piece>
      ))}
      <span className="bob-slow absolute right-[8%] top-[9%]"><Moon size={58} /></span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="cloud absolute" style={{ top: `${12 + i * 17}%`, animationDuration: `${70 + i * 25}s`, animationDelay: `${-i * 31}s` }}>
          <Cloud size={96 - i * 10} tone="#cfd8e6" />
        </span>
      ))}
    </>
  );
}

function Lanterns() {
  return (
    <>
      {[10, 46, 80].map((left, i) => (
        <Piece key={left} mode="kick" colors={LANTERN_BITS} slop={20} className="swing absolute top-0" style={{ left: `${left}%`, animationDuration: `${4.5 + i}s`, animationDelay: `${-i * 1.7}s` }}>
          <Lantern size={46 + (i % 2) * 8} />
        </Piece>
      ))}
    </>
  );
}

/** How long a scared creature stays lunging at the screen. */
const SCARE_MS = 1300;
const KINDS = ["dracula", "wolf", "monster"] as const;
type Kind = (typeof KINDS)[number];
const SPRITES: Record<Kind, ReactNode> = { dracula: <Dracula />, wolf: <Wolf />, monster: <Monster /> };

interface Point { x: number; y: number }
const quad = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * c.y + t * t * b.y,
});

/**
 * One character walking a route: in from the bottom-left or the top, a full circle near the middle of the
 * screen, then out again by the same edge. Positions are written straight to the element, not through React.
 */
function Walk({ kind, route, onDone }: { kind: Kind; route: "bottom" | "top"; onDone: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  // When a tap scared it, the moment it began; the walk pauses while it lunges, then carries on.
  const scareStart = useRef<number | null>(null);
  useDecorTap(holder, () => {
    if (scareStart.current === null) scareStart.current = performance.now();
  });
  // Kept in a ref so a re-render of the parent never restarts the walk.
  const finished = useRef(onDone);
  useEffect(() => {
    finished.current = onDone;
  });

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r = Math.min(W * 0.22, H * 0.16);
    const centre = { x: W * 0.5, y: H * 0.52 };
    const bottom = route === "bottom";
    const from: Point = bottom ? { x: -0.15 * W, y: H * 0.92 } : { x: W * between(0.3, 0.7), y: -0.12 * H };
    const to: Point = bottom ? { x: 1.15 * W, y: H * 0.96 } : { x: W * between(0.25, 0.75), y: -0.14 * H };
    const angle0 = bottom ? Math.PI : -Math.PI / 2;
    const entry: Point = { x: centre.x + r * Math.cos(angle0), y: centre.y + r * Math.sin(angle0) };
    const bend = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2 + between(-0.15, 0.15) * W, y: (a.y + b.y) / 2 });
    const in1 = bend(from, entry);
    const out1 = bend(entry, to);
    const TOTAL = 26000;
    const IN = 0.27;
    const LOOP = 0.46;
    let started = performance.now();
    let lastNow = started;
    let last = from;
    let face = 1;
    let frame = 0;

    const step = (now: number) => {
      const dt = now - lastNow;
      lastNow = now;
      let grow = 1;
      let shake = 0;
      const scared = scareStart.current;
      if (scared !== null) {
        const k = (now - scared) / SCARE_MS;
        if (k >= 1) scareStart.current = null;
        else {
          // Frozen on the spot: the clock stops, it swells toward you and trembles, then settles.
          started += dt;
          grow = 1 + 1.1 * Math.sin(Math.PI * Math.min(1, k * 1.1));
          shake = Math.sin(k * 70) * 5 * (1 - k);
        }
      }
      const t = Math.min(1, (now - started) / TOTAL);
      let p: Point;
      if (t < IN) p = quad(from, in1, entry, t / IN);
      else if (t < IN + LOOP) {
        const angle = angle0 + ((t - IN) / LOOP) * Math.PI * 2;
        p = { x: centre.x + r * Math.cos(angle), y: centre.y + r * Math.sin(angle) };
      } else p = quad(entry, out1, to, (t - IN - LOOP) / (1 - IN - LOOP));
      if (Math.abs(p.x - last.x) > 0.15) face = p.x >= last.x ? 1 : -1;
      last = p;
      el.style.transform = `translate(${p.x - 40 + shake}px, ${p.y - 40}px) scale(${face * grow}, ${grow})`;
      if (t < 1) frame = requestAnimationFrame(step);
      else finished.current();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [route]);

  return (
    <div ref={holder} data-slop={12} className="absolute left-0 top-0 will-change-transform" style={{ transform: "translate(-200px, -200px)" }}>
      <div className="walker-bob">{SPRITES[kind]}</div>
    </div>
  );
}

function Walkers() {
  const [walker, setWalker] = useState<{ id: number; kind: Kind; route: "bottom" | "top" } | null>(null);
  const spawned = useRef(false);

  useEffect(() => {
    if (walker) return;
    // The first visitor arrives soon; after that there are long quiet gaps.
    const timer = setTimeout(() => {
      spawned.current = true;
      if (document.visibilityState === "visible") setWalker({ id: Date.now(), kind: pick(KINDS), route: pick(["bottom", "top"] as const) });
      else setWalker(null);
    }, (spawned.current ? between(25, 60) : between(5, 10)) * 1000);
    return () => clearTimeout(timer);
  }, [walker]);

  if (!walker) return null;
  return <Walk key={walker.id} kind={walker.kind} route={walker.route} onDone={() => setWalker(null)} />;
}

const WAIT_SLEIGH: [number, number] = [50, 90];
const WAIT_CUPID: [number, number] = [60, 100];
const WAIT_BATS: [number, number] = [30, 60];
const GAP_FEW: [number, number] = [3.5, 7];
const GAP_FEWER: [number, number] = [6, 12];

const PETALS = ["#ff7aa8", "#ff4d7d", "#ffb3cf"];
const BALLOONS = ["#ff5c8a", "#5cc8ff", "#ffd54a", "#7ce0c3", "#c58bff", "#ff8a2a"];
const SPRINKLES = ["#ff5c8a", "#5cc8ff", "#ffd54a", "#62d26f", "#c58bff"];
const SNOW_BITS = ["#ffffff", "#cfe8ff", "#e6f3ff"];
const SLEIGH_BITS = ["#ffd54a", "#e5322d", "#62d26f", "#ffffff"];

const SCENES: Record<string, () => ReactNode> = {
  christmas: () => (
    <>
      <Drifting count={24} direction="down" bits={SNOW_BITS} render={(i) => <Snowflake size={10 + Math.round(seeded(i, 6) * 14)} />} />
      <Crosser top="7%" seconds={16} wait={WAIT_SLEIGH} first={20} bits={SLEIGH_BITS}><Sleigh /></Crosser>
    </>
  ),
  valentines: () => (
    <>
      <Drifting count={14} direction="down" slow={1.3} bits={PETALS} render={(i) => <Petal size={10 + Math.round(seeded(i, 6) * 10)} color={PETALS[i % PETALS.length]} />} />
      <Crosser top="16%" seconds={20} wait={WAIT_CUPID} first={25} bits={PETALS}><Accent name="cupid" size={54} /></Crosser>
    </>
  ),
  "lunar-new-year": () => <Lanterns />,
  "eid-al-fitr": () => <Night />,
  "eid-al-adha": () => <Night />,
  "new-year": () => <Fireworks colors={GOLD} gap={GAP_FEW} />,
  "canada-day": () => <Fireworks colors={RED} gap={GAP_FEWER} />,
  diwali: () => <Fireworks colors={MULTI} gap={GAP_FEW} />,
  birthday: () => (
    <>
      <Drifting count={7} direction="up" slow={1.1} bits={BALLOONS} render={(i) => <Balloon size={34 + Math.round(seeded(i, 6) * 16)} color={BALLOONS[i % BALLOONS.length]} />} />
      <Drifting count={16} direction="down" slow={1.4} bits={SPRINKLES} render={(i) => <i className="block h-1.5 w-3 rounded-full" style={{ background: SPRINKLES[i % SPRINKLES.length], transform: `rotate(${i * 37}deg)` }} />} />
    </>
  ),
  halloween: () => (
    <>
      <Walkers />
      <Crosser top="14%" seconds={11} wait={WAIT_BATS} first={30} slop={34}>
        {(scattered) => (
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`block ${scattered ? "bat-scatter" : ""}`}
                style={{ "--dx": `${(i - 2) * 70 + (i % 2 ? 30 : -30)}px`, "--dy": `${i % 2 ? -260 : -180}px` } as CSSProperties}
              >
                <span className="flap" style={{ marginTop: (i % 3) * 14, animationDelay: `${i * 0.08}s` }}><Bat size={22 + (i % 2) * 8} /></span>
              </span>
            ))}
          </div>
        )}
      </Crosser>
    </>
  ),
};

export default function Scene() {
  const { theme, animations } = useDecor();
  if (!theme || !animations) return null;
  const scene = SCENES[theme.slug]?.();
  if (!scene) return null;
  // Behind everything: negative depth puts it under the page's text and cards, which is why taps are caught on the window.
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden motion-reduce:hidden">{scene}</div>;
}
