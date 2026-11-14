// lib/ports/geo.ts
import type { Result } from "./result";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  city: string | null;
  /** ISO 3166-1 alpha-2 code, upper case. */
  country: string | null;
}

/** Turns a place name or address into coordinates, and coordinates into a city. */
export interface Geocoder {
  locate(query: string): Promise<Result<GeoPoint | null>>;
  /** The city and country code at a position, for "Current location". */
  reverse(latitude: number, longitude: number): Promise<Result<{ city: string; region: string } | null>>;
}
