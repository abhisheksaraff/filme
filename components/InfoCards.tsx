// components/InfoCards.tsx
// The strip of small cards at the top of a page (Details, Genres, Watched...). A card with nothing to say is left out.
const CARD = "flex w-40 shrink-0 flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900";

export interface InfoCard {
  label: string;
  /** Null, false or empty leaves the card out. */
  value: string | null | false | undefined;
}

/** "3 times", or null for none so the Watched card is left out. */
export const timesText = (n: number): string | null => (n > 0 ? `${n} ${n === 1 ? "time" : "times"}` : null);

export default function InfoCards({ cards }: { cards: InfoCard[] }) {
  const shown = cards.filter((c) => !!c.value);
  if (shown.length === 0) return null;
  return (
    <ul className="-mx-5 flex gap-3 overflow-x-auto px-5">
      {shown.map((c) => (
        <li key={c.label} className={CARD}>
          <span className="text-neutral-500">{c.label}</span>
          <span>{c.value}</span>
        </li>
      ))}
    </ul>
  );
}
