// lib/domain/listSort.ts
// The one set of orders for Watched, the Watchlist and a location's viewings, so they read the same everywhere.

export type ListSort = "new" | "old" | "high" | "low" | "release-new" | "release-old";

export const LIST_SORTS: { id: ListSort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "old", label: "Oldest" },
  { id: "high", label: "Highest rated" },
  { id: "low", label: "Lowest rated" },
  { id: "release-new", label: "Release date, newest" },
  { id: "release-old", label: "Release date, oldest" },
];

interface Getters<T> {
  /** When it was watched, or added to the Watchlist: anything that sorts as text, oldest first. Null when unknown. */
  date: (item: T, index: number) => string | null;
  /** The score shown for it, or null. */
  score: (item: T) => number | null;
  /** When it came out (a year or a full date), or null. */
  release: (item: T) => string | null;
}

/**
 * Orders a list. Whatever is missing (no date, no score, no release date) always goes last, whichever way round the list runs,
 * and ties keep the order they came in.
 */
export function sortList<T>(list: T[], sort: ListSort, get: Getters<T>): T[] {
  const dir = sort === "old" || sort === "low" || sort === "release-old" ? 1 : -1;
  const key = (item: T, index: number): string | number | null =>
    sort === "high" || sort === "low" ? get.score(item) : sort === "release-new" || sort === "release-old" ? get.release(item) : get.date(item, index);
  return list
    .map((item, index) => ({ item, index, k: key(item, index) }))
    .sort((a, b) => {
      if (a.k === null || b.k === null) return Number(a.k === null) - Number(b.k === null) || a.index - b.index;
      const c = typeof a.k === "number" && typeof b.k === "number" ? a.k - b.k : String(a.k).localeCompare(String(b.k));
      return c * dir || a.index - b.index;
    })
    .map((x) => x.item);
}
