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

/** Every row Home can show, in the order they are offered. */
export const HOME_ROWS: readonly HomeRowDef[] = [
  { id: "like-movie", label: "You might also like" },
  { id: "like-tv", label: "TV shows you might like" },
  { id: "want", label: "Want to watch" },
  { id: "favourites", label: "New from your favourites" },
  { id: "theatres", label: "In theatres near you" },
  { id: "soon", label: "Opening soon" },
  { id: "arriving", label: "Arriving from your list" },
  { id: "arthouse", label: "Art house" },
  { id: "wildcard", label: "Wildcard" },
  ...GENRES.map((g) => ({ id: `genre-${g.id}`, label: g.name })),
];

/** Shown until the user customises Home. */
export const DEFAULT_HOME_ROWS: readonly string[] = [
  "like-movie", "want", "theatres", "favourites", "soon", "arthouse", "wildcard", "like-tv", "genre-28", "genre-35", "genre-27", "genre-878",
];

const KNOWN = new Set(HOME_ROWS.map((row) => row.id));

/** Rows that were renamed or removed: layouts saved earlier still name them. */
const RENAMED: Record<string, string> = { recent: "like-movie" };

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
