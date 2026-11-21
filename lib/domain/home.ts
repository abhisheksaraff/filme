// lib/domain/home.ts
// The rows the Home screen can show, and how a saved list of row ids becomes the layout.

/** TMDB movie genres, used for the genre rows and the random surprise picks. */
export const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
] as const;

export interface HomeRowDef {
  id: string;
  label: string;
}

/** TMDB's TV genres that get a Home row of their own (TV has its own genre ids), with the row's title. */
export const TV_GENRES: readonly { id: number; label: string }[] = [
  { id: 18, label: "TV dramas" },
  { id: 35, label: "TV comedies" },
  { id: 80, label: "Crime TV" },
  { id: 10765, label: "Sci-fi & fantasy TV" },
  { id: 9648, label: "Mystery TV" },
  { id: 16, label: "Animated series" },
  { id: 99, label: "Documentary series" },
  { id: 10759, label: "Action & adventure TV" },
];

/** Every row Home can show, in the order they are offered. */
export const HOME_ROWS: readonly HomeRowDef[] = [
  { id: "like-movie", label: "You might also like" },
  { id: "continue", label: "Continue watching" },
  { id: "collections-mine", label: "From your collections" },
  { id: "collections-new", label: "Discover collections" },
  { id: "like-tv", label: "TV shows you might like" },
  { id: "want-pick", label: "From your watchlist" },
  { id: "because-saved", label: "Similar to a saved title" },
  { id: "tv-acclaimed", label: "Acclaimed TV" },
  ...TV_GENRES.map((g) => ({ id: `tv-${g.id}`, label: g.label })),
  { id: "favourites", label: "New from your favourites" },
  { id: "theatres", label: "In theatres near you" },
  { id: "soon", label: "Opening soon" },
  { id: "arriving", label: "Arriving from your list" },
  { id: "arthouse", label: "Art house" },
  { id: "wildcard", label: "World Cinema" },
  ...GENRES.map((g) => ({ id: `genre-${g.id}`, label: g.name })),
];

/** Shown until the user customises Home. */
export const DEFAULT_HOME_ROWS: readonly string[] = [
  "continue", "collections-mine", "collections-new", "like-movie", "want-pick", "theatres", "favourites", "soon", "arthouse", "wildcard", "like-tv", "genre-28", "genre-35", "genre-27", "genre-878",
];

/** Rows the very first saved layouts predate; they are added once to layouts saved before rows were tracked. */
const ADDED_LATER = ["like-tv", "continue"];

/** Rows that show several rows at once: a collections entry on Home is this many rows, each a different collection. */
export const COLLECTION_ROWS = 3;

/** Turns the layout's ids into the rows drawn: "collections-mine" becomes three rows, "collections-mine:0" to ":2". */
export function expandRows(ids: readonly string[]): string[] {
  return ids.flatMap((id) => (id === "collections-mine" || id === "collections-new" ? Array.from({ length: COLLECTION_ROWS }, (_, i) => `${id}:${i}`) : [id]));
}

/** The layout id behind a drawn row ("collections-mine:1" is "collections-mine"). */
export const baseRowId = (id: string): string => (id.startsWith("collections-") ? id.split(":")[0] : id);

/**
 * Adds rows a saved layout has not been offered yet. `seen` is the list it was last saved against;
 * null means it was saved before rows were tracked. A row turned off afterwards stays off.
 */
export function addNewRows(layout: readonly string[], seen: readonly string[] | null): string[] {
  const all = HOME_ROWS.map((row) => row.id);
  const known = new Set(seen ?? all.filter((id) => !ADDED_LATER.includes(id)));
  const fresh = all.filter((id) => !known.has(id) && !layout.includes(id));
  // Continue watching goes first: it is what you open the app to see.
  const PRIORITY = ["continue"];
  const first = fresh.filter((id) => PRIORITY.includes(id));
  return [...first, ...layout, ...fresh.filter((id) => !first.includes(id))];
}

/** Every row id Home can show, recorded when a layout is saved. */
export const ALL_ROW_IDS: readonly string[] = HOME_ROWS.map((row) => row.id);

/** Languages the Art House row draws from, with the country shown under its title. */
export const ART_HOUSE: readonly { language: string; country: string }[] = [
  { language: "fr", country: "France" }, { language: "de", country: "Germany" }, { language: "it", country: "Italy" },
  { language: "ja", country: "Japan" }, { language: "ru", country: "Russia" }, { language: "pl", country: "Poland" },
  { language: "sv", country: "Sweden" }, { language: "hu", country: "Hungary" }, { language: "cs", country: "Czechia" },
  { language: "es", country: "Spain" }, { language: "pt", country: "Portugal" }, { language: "da", country: "Denmark" },
];

/** Languages the World Cinema row draws from, with the country shown under its title. */
export const WORLD_CINEMA: readonly { language: string; country: string }[] = [
  { language: "ko", country: "Korea" }, { language: "ja", country: "Japan" }, { language: "es", country: "Spain" },
  { language: "it", country: "Italy" }, { language: "hi", country: "India" }, { language: "th", country: "Thailand" },
  { language: "tr", country: "Turkey" }, { language: "sv", country: "Sweden" }, { language: "pt", country: "Portugal" },
  { language: "zh", country: "China" }, { language: "fa", country: "Iran" }, { language: "pl", country: "Poland" },
  { language: "da", country: "Denmark" }, { language: "el", country: "Greece" }, { language: "id", country: "Indonesia" },
  { language: "he", country: "Israel" },
];

const KNOWN = new Set(HOME_ROWS.map((row) => row.id));

/** Rows that were renamed or merged into another: layouts saved earlier still name them. */
const RENAMED: Record<string, string> = { recent: "like-movie", "new-episodes": "continue", want: "want-pick", "like-watchlist": "because-saved" };

/** The saved ids with unknown and repeated ones dropped; nothing saved means the defaults. */
export function resolveHomeRows(stored: readonly string[]): string[] {
  const ids = [...new Set(stored.map((id) => RENAMED[id] ?? id))].filter((id) => KNOWN.has(id));
  return ids.length > 0 ? ids : [...DEFAULT_HOME_ROWS];
}

export interface HomeRowState extends HomeRowDef {
  on: boolean;
}

/** All rows for the Customize screen: the switched-on ones in their order, then the rest. */
export function arrangeHomeRows(enabled: readonly string[]): HomeRowState[] {
  const label = new Map(HOME_ROWS.map((row) => [row.id, row.label]));
  const on = enabled.filter((id) => label.has(id)).map((id) => ({ id, label: label.get(id) as string, on: true }));
  const off = HOME_ROWS.filter((row) => !enabled.includes(row.id)).map((row) => ({ ...row, on: false }));
  return [...on, ...off];
}
