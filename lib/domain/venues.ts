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
