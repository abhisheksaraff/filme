// lib/ports/geo.ts
import type { Result } from "./result";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  city: string | null;
  /** ISO 3166-1 alpha-2 code, upper case. */
  country: string | null;
}

/** A place found by name or address. */
export interface PlaceHit {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
}

/** Turns a place name or address into coordinates, and coordinates into a city. */
export interface Geocoder {
  /** Several matches for a name or address, for suggestions while typing. */
  search(query: string): Promise<Result<PlaceHit[]>>;
  /**
   * The position of a place. Given several phrasings, the first that finds something wins; a place
   * picked earlier from the suggestions is remembered, so its exact position is used without a search.
   */
  locate(query: string | string[]): Promise<Result<GeoPoint | null>>;
  /** The city and country code at a position, for "Current location". */
  reverse(latitude: number, longitude: number): Promise<Result<{ city: string; region: string } | null>>;
}
