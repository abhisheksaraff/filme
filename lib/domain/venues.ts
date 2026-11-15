// lib/domain/venues.ts
import { z } from "zod";
import { idSchema } from "./primitives";

export const VENUE_TYPES = ["cinema", "theatre", "arena", "stadium", "club", "festival", "home", "other"] as const;
export const venueTypeSchema = z.enum(VENUE_TYPES);

/** A place the user watched something; coordinates feed the venue globe. */
export const venueSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: venueTypeSchema,
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});
export type Venue = z.infer<typeof venueSchema>;

/**
 * How to search for a venue's position, most exact first: the address alone (the way the suggestion
 * list showed it), then the name with the address, then the name alone. Repeating the name inside
 * the address made a search that found nothing.
 */
export function placeQueries(name: string, address: string | null): string[] {
  const text = (address ?? "").trim();
  if (!text) return [name];
  const withName = text.toLowerCase().startsWith(name.trim().toLowerCase()) ? text : `${name}, ${text}`;
  return [text, withName, name];
}
