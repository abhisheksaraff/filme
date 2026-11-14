// lib/adapters/geo/NominatimGeocoder.ts
// Looks places up on OpenStreetMap's Nominatim. It asks for at most one lookup a second.
import type { Geocoder } from "@/lib/ports/geo";
import { fail, ok } from "@/lib/ports/result";

const BASE = "https://nominatim.openstreetmap.org";
const TIMEOUT_MS = 10_000;
const MIN_GAP_MS = 1100;

interface Address {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country_code?: string;
}

/** Queue of lookups so they are spaced out, as Nominatim's usage policy requires. */
let last = Promise.resolve();

function spaced<T>(task: () => Promise<T>): Promise<T> {
  const run = last.then(task);
  last = run.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS)),
  );
  return run;
}

const cityOf = (a: Address | undefined) => a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.county ?? null;

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "Accept-Language": "en" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

interface SearchRow {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Address;
}

export const nominatimGeocoder: Geocoder = {
  search(query) {
    return spaced(async () => {
      const rows = await get<SearchRow[]>(`/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`);
      if (rows === null) return fail("Could not reach the map service.");
      return ok(
        rows.map((row) => ({
          // A named place (a cinema) has a name of its own; a plain address uses its first part.
          name: row.name || row.display_name.split(",")[0].trim(),
          address: row.display_name,
          latitude: Number(row.lat),
          longitude: Number(row.lon),
          city: cityOf(row.address),
          country: row.address?.country_code?.toUpperCase() ?? null,
        })),
      );
    });
  },

  locate(query) {
    return spaced(async () => {
      const rows = await get<{ lat: string; lon: string; address?: Address }[]>(
        `/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`,
      );
      if (rows === null) return fail("Could not reach the map service.");
      const hit = rows[0];
      if (!hit) return ok(null);
      return ok({
        latitude: Number(hit.lat),
        longitude: Number(hit.lon),
        city: cityOf(hit.address),
        country: hit.address?.country_code?.toUpperCase() ?? null,
      });
    });
  },

  reverse(latitude, longitude) {
    return spaced(async () => {
      const row = await get<{ address?: Address }>(`/reverse?format=jsonv2&zoom=10&lat=${latitude}&lon=${longitude}`);
      if (row === null) return fail("Could not reach the map service.");
      const city = cityOf(row.address);
      const region = row.address?.country_code?.toUpperCase();
      return ok(city && region ? { city, region } : null);
    });
  },
};
