// lib/ports/browse.ts
import type { GeoPoint } from "./geo";
import type { Result } from "./result";

/** One person's credit on a title, as saved in the database. */
export interface CreditPerson {
  personId: string;
  tmdbId: number | null;
  name: string;
  role: string;
  character: string | null;
  profilePath: string | null;
}

export interface TitleCredits {
  genres: string[];
  people: CreditPerson[];
}

/** A title a person worked on, with every role they had in it. */
export interface PersonWork {
  mediaId: string;
  title: string;
  category: string;
  year: string | null;
  posterPath: string | null;
  roles: string[];
  seen: boolean;
}

export interface PersonDetail {
  id: string;
  tmdbId: number | null;
  name: string;
  profilePath: string | null;
  works: PersonWork[];
}

export interface VenueViewing {
  sessionId: string;
  mediaId: string;
  title: string;
  posterPath: string | null;
  watchedOn: string | null;
  rating: number | null;
}

export interface VenueDetail {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  viewings: VenueViewing[];
}

/** A venue with a position, for the globe. */
export interface VenuePoint {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  count: number;
}

/** Everything linked from a title: its credits, the people, their other work, and venues. */
export interface BrowseRepository {
  titleCredits(mediaId: string): Promise<Result<TitleCredits>>;
  person(id: string): Promise<Result<PersonDetail>>;
  /** Our own id for a person TMDB knows, or null if they are not saved yet. */
  personIdByTmdb(tmdbId: number): Promise<Result<string | null>>;
  venue(id: string): Promise<Result<VenueDetail>>;
  venuePoints(): Promise<Result<VenuePoint[]>>;
  /** Venues that have no position yet. */
  unlocatedVenues(limit: number): Promise<Result<{ id: string; name: string; address: string | null }[]>>;
  setVenueLocation(id: string, point: GeoPoint): Promise<Result<void>>;
}
