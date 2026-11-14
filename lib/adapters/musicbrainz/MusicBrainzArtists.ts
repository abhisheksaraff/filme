// lib/adapters/musicbrainz/MusicBrainzArtists.ts
// Finds artists on MusicBrainz, which has musicians and bands that TMDB does not.
import type { ArtistSearch } from "@/lib/ports/artists";
import { fail, ok } from "@/lib/ports/result";

const TIMEOUT_MS = 10_000;

interface ArtistRow {
  id: string;
  name: string;
  disambiguation?: string;
  type?: string;
  country?: string;
}

export const musicBrainzArtists: ArtistSearch = {
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return ok([]);
    try {
      const res = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(q)}&fmt=json&limit=6`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return fail("Could not search for artists right now.");
      const body = (await res.json()) as { artists?: ArtistRow[] };
      return ok(
        (body.artists ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          note: [a.disambiguation, a.type, a.country].filter(Boolean).join(" · ") || null,
        })),
      );
    } catch {
      return fail("Could not reach the artist search.");
    }
  },
};
