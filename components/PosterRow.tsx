// components/PosterRow.tsx
// A sideways-scrolling strip of posters. On Continue watching a first tap lifts the whole poster, name and date included, onto a
// white card and shows an x; a second tap opens the show.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { ConfirmPopup } from "@/components/Popup";
import ProblemPopup from "@/components/ProblemPopup";
import StatusBadge from "@/components/StatusBadge";
import { warmTitle } from "@/lib/handoff";
import { useWantedKeys, wantedKeyOf } from "@/lib/useWantedKeys";
import type { RowItem } from "@/lib/home/rows";

/** The biggest the ring (and the x beside it) grows, in pixels. */
const RING_MAX = 24;
/** The ring's width as the badge sizes it (a quarter of the poster, within limits), so `left` can park it against the right edge. */
const RING_WIDTH = `clamp(18px, 24%, ${RING_MAX}px)`;

interface Props {
  items: RowItem[];
  /** Takes a poster off the row; resolves to a message when it could not be done. Only posters with `removable` use it. */
  onRemove?: (item: RowItem) => Promise<string | null>;
  /** Lays the posters out in a grid that wraps instead of one sideways strip. */
  grid?: boolean;
}

export default function PosterRow({ items, onRemove, grid }: Props) {
  const wanted = useWantedKeys();
  // The one poster that is lifted, and the one waiting for the answer to "Remove from Home".
  const [lifted, setLifted] = useState<string | null>(null);
  const [asking, setAsking] = useState<RowItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // A lifted poster goes back down when you tap anywhere else or scroll, the row sideways or the page.
  useEffect(() => {
    if (lifted === null) return;
    const down = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.("[data-lifted]")) setLifted(null);
    };
    const drop = () => setLifted(null);
    document.addEventListener("pointerdown", down);
    window.addEventListener("scroll", drop, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("scroll", drop, { capture: true });
    };
  }, [lifted]);

  async function confirmRemove() {
    if (!asking || !onRemove) return;
    setBusy(true);
    const message = await onRemove(asking);
    setBusy(false);
    setAsking(null);
    setLifted(null);
    if (message) setProblem(message);
  }

  return (
    <>
      {/* Room above and below the posters for a lifted card and its shadow to grow into; the negative margins give it back so nothing moves. */}
      <ul className={grid ? "grid grid-cols-3 gap-x-3 gap-y-4 md:grid-cols-5 lg:grid-cols-6" : "-mx-5 -mb-8 -mt-3 flex gap-3 overflow-x-auto px-5 pb-10 pt-3"}>
        {items.map((item) => {
          const removable = !!item.removable && !!onRemove;
          const up = removable && lifted === item.key;
          const partly = item.progress !== undefined;
          return (
            <li key={item.key} className={grid ? "min-w-0" : "w-28 shrink-0 md:w-36 lg:w-40"}>
              <Link
                href={item.href}
                onClick={(e) => {
                  // The first tap on a Continue watching poster only lifts it; the next one opens the show.
                  if (removable && !up) {
                    e.preventDefault();
                    setLifted(item.key);
                    return;
                  }
                  warmTitle(item.href, { title: item.title, posterUrl: item.posterUrl, subtitle: item.subtitle });
                }}
                {...(up ? { "data-lifted": "" } : {})}
                className={`relative isolate flex flex-col gap-1 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${up ? "z-20 scale-[1.04]" : ""}`}
              >
                {/* The white card behind the poster, name and date. It reaches past them without moving anything, and fades in with a shadow. */}
                {removable && (
                  <span
                    aria-hidden
                    className={`absolute -inset-1.5 -z-10 rounded-2xl bg-white transition-[opacity,box-shadow] duration-300 dark:bg-neutral-900 ${
                      up ? "opacity-100 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(0,0,0,0.4),0_6px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_14px_28px_-8px_rgba(0,0,0,0.9)]" : "opacity-0"
                    }`}
                  />
                )}
                <div className="relative rounded-lg">
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-lg object-cover" />
                  ) : (
                    <div className="aspect-[2/3] w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  {/* The ring sits top right. On a lifted poster it gives way to the x, which carries the same progress as a thin outline. */}
                  {partly && (
                    <StatusBadge
                      kind="watched"
                      progress={item.progress}
                      maxSize={RING_MAX}
                      className={`absolute right-[4%] top-[3%] transition-opacity duration-300 ${up ? "opacity-0" : ""}`}
                    />
                  )}
                  {!partly && item.watched && <StatusBadge kind="watched" maxSize={28} className="absolute right-[4%] top-[3%]" />}
                  {/* The ring wins when a show is both partly watched and on the watchlist. */}
                  {!partly && !item.watched && wanted.has(wantedKeyOf(item.href) ?? "") && <StatusBadge kind="watchlist" maxSize={28} className="absolute right-[4%] top-[3%]" />}
                  {removable && (
                    <span style={{ width: RING_WIDTH }} className={`absolute right-[4%] top-[3%] aspect-square transition-opacity duration-300 ease-out ${up ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title} from Home`}
                        tabIndex={up ? 0 : -1}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setAsking(item);
                        }}
                        className="relative flex h-full w-full items-center justify-center rounded-full bg-black text-white shadow-md before:absolute before:-inset-2 before:content-['']"
                      >
                        <Icon name="close" size={12} />
                      </button>
                      {/* A thin outline round the x: a dark track with a white arc for how far through you are. */}
                      <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -inset-[3px] h-[calc(100%+6px)] w-[calc(100%+6px)] -rotate-90">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="8" />
                        <circle cx="50" cy="50" r="46" fill="none" stroke="#ffffff" strokeWidth="8" pathLength={100} strokeDasharray={`${Math.min(0.97, Math.max(0.04, item.progress ?? 0)) * 100} 100`} />
                      </svg>
                    </span>
                  )}
                </div>
                {/* The year sits straight under the title, one line or two; the box keeps one fixed height so every row is the same height before and after its pictures load. */}
                <span className="flex h-12 flex-col">
                  <span className="line-clamp-2 text-xs font-medium leading-4">{item.title}</span>
                  <span className="text-xs leading-4 text-neutral-500">{item.subtitle}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {asking && (
        <ConfirmPopup
          title="Remove from Home"
          message={`${asking.title} leaves Continue watching.`}
          confirmLabel="Remove from Home"
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setAsking(null)}
        />
      )}
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
    </>
  );
}
