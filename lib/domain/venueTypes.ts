// lib/domain/venueTypes.ts
// What kind of place a viewing happened at. The type picks the icon on the map pins and the small maps, and is chosen
// by hand in the venue field; when it is not chosen, it follows the kind of thing being logged.
import type { IconName } from "@/components/Icon";

export const VENUE_TYPES = [
  { id: "cinema", label: "Cinema", icon: "film" },
  { id: "home", label: "Home", icon: "home" },
  { id: "concert", label: "Concert hall", icon: "mic" },
  { id: "theatre", label: "Theatre", icon: "masks" },
  { id: "dance", label: "Dance", icon: "dancer" },
  { id: "comedy", label: "Comedy club", icon: "comedy" },
  { id: "arena", label: "Arena or stadium", icon: "stadium" },
  { id: "festival", label: "Festival", icon: "tent" },
  { id: "drivein", label: "Drive-in", icon: "car" },
  { id: "friend", label: "Friend's place", icon: "people" },
  { id: "travel", label: "On the move", icon: "plane" },
  { id: "other", label: "Other", icon: "pin" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type VenueType = (typeof VENUE_TYPES)[number]["id"];

/** Every id the database accepts, including two older ones that now read as arena and concert hall. */
export const VENUE_TYPE_IDS: string[] = [...VENUE_TYPES.map((t) => t.id), "stadium", "club"];

const LEGACY: Record<string, VenueType> = { stadium: "arena", club: "concert" };

/** A stored type as one of the current ones; anything unknown reads as Other. */
export function normalizeVenueType(type: string | null | undefined): VenueType {
  if (!type) return "other";
  if (type in LEGACY) return LEGACY[type];
  return VENUE_TYPES.some((t) => t.id === type) ? (type as VenueType) : "other";
}

/** The type a new venue gets when none was chosen. */
export function defaultVenueType(category: string): VenueType {
  return category === "Movie" ? "cinema" : category === "TV Show" ? "home" : category === "Concert" ? "concert" : category === "Live Event" ? "theatre" : "other";
}

/** The type a viewing counts as: the one saved on the viewing, else its venue's, else what the category suggests. */
export function effectiveVenueType(sessionType: string | null | undefined, venueType: string | null | undefined, category: string): VenueType {
  if (sessionType) return normalizeVenueType(sessionType);
  if (venueType) return normalizeVenueType(venueType);
  return defaultVenueType(category);
}

export const venueIcon = (type: string | null | undefined): IconName => VENUE_TYPES.find((t) => t.id === normalizeVenueType(type))?.icon ?? "pin";
export const venueTypeLabel = (type: string | null | undefined): string => VENUE_TYPES.find((t) => t.id === normalizeVenueType(type))?.label ?? "Other";
