// components/PosterRow.tsx
// A sideways-scrolling strip of posters. On Continue watching a first tap lifts the poster and shows an x; a second tap opens the show.
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

/** The biggest the ring (and the x that takes its place) grows, in pixels. */
const RING_MAX = 24;
/** The ring's width as the badge sizes it (a quarter of the poster, within limits), so `left` can park it against the right edge. */
const RING_WIDTH = `clamp(18px, 24%, ${RING_MAX}px)`;

interface Props {
  items: RowItem[];
  /** Takes a poster off the row; resolves to a message when it could not be done. Only posters with `removable` use it. */
  onRemove?: (item: RowItem) => Promise<string | null>;
}

export default function PosterRow({ items, onRemove }: Props) {
  const wanted = useWantedKeys();
  // The one poster that is lifted, and the one waiting for the answer to "Remove from Home?".
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
      {/* Room above the posters for a lifted one to grow into; the negative margin gives it back so nothing moves. */}
      <ul className="-mx-5 -mt-3 flex gap-3 overflow-x-auto px-5 pb-2 pt-3">
        {items.map((item) => {
          const removable = !!item.removable && !!onRemove;
          const up = removable && lifted === item.key;
          const partly = item.progress !== undefined;
          return (
            <li key={item.key} className="w-28 shrink-0 md:w-36 lg:w-40">
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
                className="flex flex-col gap-1"
              >
                <div
                  {...(up ? { "data-lifted": "" } : {})}
                  className={`relative origin-bottom rounded-lg transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    up ? "z-20 scale-[1.05] shadow-[0_1px_2px_rgba(0,0,0,0.1),0_6px_14px_-4px_rgba(0,0,0,0.3)] ring-[3px] ring-white dark:ring-neutral-900" : ""
                  }`}
                >
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-lg object-cover" />
                  ) : (
                    <div className="aspect-[2/3] w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  {/* The ring sits top right; on a lifted poster it slides left to make room for the x. */}
                  {partly && (
                    <StatusBadge
                      kind="watched"
                      progress={item.progress}
                      maxSize={RING_MAX}
                      className={`absolute top-[3%] ${removable ? "transition-[left] duration-300 ease-out" : "right-[4%]"}`}
                      style={removable ? { left: up ? "4%" : `calc(96% - ${RING_WIDTH})` } : undefined}
                    />
                  )}
                  {/* The ring wins when a show is both partly watched and on the watchlist. */}
                  {!partly && wanted.has(wantedKeyOf(item.href) ?? "") && <StatusBadge kind="watchlist" maxSize={28} className="absolute right-[4%] top-[3%]" />}
                  {removable && (
                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from Home`}
                      tabIndex={up ? 0 : -1}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAsking(item);
                      }}
                      style={{ width: RING_WIDTH }}
                      className={`absolute right-[4%] top-[3%] flex aspect-square items-center justify-center rounded-full bg-black text-white shadow-md ring-2 ring-white transition-[opacity,transform] duration-300 ease-out before:absolute before:-inset-2 before:content-[''] dark:ring-neutral-950 ${
                        up ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0"
                      }`}
                    >
                      <Icon name="close" size={12} />
                    </button>
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
          title="Remove from Home?"
          message={`${asking.title} leaves Continue watching. It comes back when you log another viewing of it.`}
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
