// components/StackCard.tsx
// A season or series finished episode by episode, as one full card with a stacked-cards button. The card mirrors the last
// episode watched until it is edited. The button swaps the card for a rounded box of the cards it was made from.
"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import WatchedCard, { type CardData } from "@/components/WatchedCard";
import type { StackNode } from "@/lib/domain/passes";
import type { CollectionViewing, ViewingSummary } from "@/lib/ports/log";
import type { Completion, StackEdit, StackFields } from "@/lib/ports/passes";

export interface ShowRef {
  mediaId: string;
  title: string;
  category: string;
  posterPath: string | null;
}

/** A viewing as a card shows it. */
export function cardOf(v: ViewingSummary, show: ShowRef): CardData {
  // A film in a collection carries its own title and poster; an episode takes the show's.
  const own = v as Partial<CollectionViewing>;
  return {
    id: v.id, mediaId: own.mediaId ?? show.mediaId, title: own.title ?? show.title, category: own.category ?? show.category, posterPath: own.posterPath !== undefined ? own.posterPath : show.posterPath,
    watchedOn: v.watchedOn, watchedAt: v.watchedAt, primaryFormat: v.primaryFormat, addons: v.addons,
    venueId: v.venueId, venue: v.venue, venueLatitude: v.venueLatitude, venueLongitude: v.venueLongitude, venueType: v.venueType,
    auditorium: v.auditorium, seats: v.seats, totalTickets: v.totalTickets, season: v.season, episode: v.episode,
  };
}

/** The last episode's details with the card's own edits laid over them. */
export function withFields(base: ViewingSummary, fields: StackFields | undefined): { card: Omit<CardData, "id" | "mediaId" | "title" | "category" | "posterPath">; rating: number | null; notes: string | null } {
  const f = fields ?? {};
  const moved = f.location !== undefined;
  return {
    card: {
      watchedOn: f.date !== undefined ? f.date : base.watchedOn,
      watchedAt: f.time !== undefined ? f.time : base.watchedAt,
      primaryFormat: f.primaryFormat !== undefined ? f.primaryFormat : base.primaryFormat,
      addons: f.addons ?? base.addons,
      venueId: "venueId" in f ? f.venueId ?? null : moved ? null : base.venueId,
      venue: moved ? f.location ?? null : base.venue,
      venueLatitude: "venueLatitude" in f ? f.venueLatitude ?? null : moved ? null : base.venueLatitude,
      venueLongitude: "venueLongitude" in f ? f.venueLongitude ?? null : moved ? null : base.venueLongitude,
      venueType: f.venueType !== undefined ? f.venueType : base.venueType,
      auditorium: f.auditorium !== undefined ? f.auditorium : base.auditorium,
      seats: f.seats ?? base.seats,
      totalTickets: f.totalTickets !== undefined ? f.totalTickets : base.totalTickets,
      season: base.season,
      episode: base.episode,
    },
    rating: f.rating !== undefined ? f.rating : base.rating,
    notes: f.notes !== undefined ? f.notes : base.notes,
  };
}

export interface LoadedCard {
  node: StackNode;
  viewings: ReadonlyMap<string, ViewingSummary>;
  edits: readonly StackEdit[];
}

interface Props {
  node: StackNode;
  viewings: ReadonlyMap<string, ViewingSummary>;
  edits: readonly StackEdit[];
  show: ShowRef;
  /** The stored cards, for the id and pictures of this one. */
  completions?: readonly Completion[];
  /** Set for a movie collection's card: where its edit page and pictures belong. */
  collectionId?: number;
  /** What the card says it is; "Season 3 completed" or "Series completed" when left out. */
  label?: string;
  /** For a card that arrives without its episodes (the Watched page): fetches them when the card is opened. */
  load?: () => Promise<LoadedCard | null>;
  /** 0 for a card on a page, 1 for one inside an opened card; the opened boxes alternate grey and white. */
  depth?: number;
  showTitle?: boolean;
  index?: number;
}

export default function StackCard({ node, viewings, edits, show, completions = [], collectionId, label: given, load, depth = 0, showTitle = false, index = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<LoadedCard | null>(null);
  const current = full ?? { node, viewings, edits };

  useEffect(() => {
    if (!open || full || !load || node.items.length > 0) return;
    let cancelled = false;
    load().then((res) => {
      if (!cancelled && res) setFull(res);
    });
    return () => {
      cancelled = true;
    };
  }, [open, full, load, node.items.length]);

  const base = current.viewings.get(current.node.last.viewingId);
  if (!base) return null;
  const edit = current.edits.find((e) => e.season === node.season && e.passKey === node.passKey);
  const mine = withFields(base, edit?.fields);
  const label = given ?? (node.season === null ? "Series completed" : `Season ${node.season} completed`);
  const stored = completions.find((c) => (collectionId !== undefined ? c.collectionId === collectionId : c.mediaId === show.mediaId) && c.season === node.season && c.passKey === node.passKey);

  if (!open) {
    return (
      <WatchedCard
        index={index}
        showTitle={showTitle}
        animate
        label={label}
        rating={mine.rating}
        notes={mine.notes}
        entry={{ ...mine.card, id: `stack:${node.id}`, mediaId: show.mediaId, title: show.title, category: show.category, posterPath: show.posterPath, season: collectionId !== undefined ? null : node.season, episode: null }}
        pictureId={base.id}
        completionId={stored?.ownPictures ? stored.id : undefined}
        editHref={collectionId !== undefined ? `/stack/?c=${collectionId}&k=${node.passKey}` : `/stack/?id=${show.mediaId}&s=${node.season ?? "show"}&k=${node.passKey}`}
        onStack={() => setOpen(true)}
      />
    );
  }

  const box = depth % 2 === 0 ? "bg-neutral-200 dark:bg-neutral-800" : "bg-white dark:bg-neutral-900";
  return (
    <li className="md:col-span-full lg:col-span-full">
      <div className={`relative rounded-[2rem] p-3 pt-4 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_16px_36px_-10px_rgba(0,0,0,0.4)] ${box}`}>
        <div className="flex items-center justify-between gap-3 px-2 pb-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black text-white before:absolute before:-inset-2 before:content-['']">
            <Icon name="close" size={18} />
          </button>
        </div>
        {current.node.items.length === 0 && <div className="skeleton h-40 rounded-3xl" />}
        <ul className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start lg:grid-cols-3">
          {current.node.items.map((item, i) => {
            if (item.type === "stack") {
              return <StackCard key={item.node.id} node={item.node} viewings={current.viewings} edits={current.edits} show={show} completions={completions} depth={depth + 1} showTitle={showTitle} index={i} />;
            }
            const v = current.viewings.get(item.viewingId);
            return v ? <WatchedCard key={v.id} index={i} showTitle={showTitle} rating={v.rating} notes={v.notes} entry={cardOf(v, show)} /> : null;
          })}
        </ul>
      </div>
    </li>
  );
}
