// lib/ports/browse.ts
import type { SeatDetail } from "@/lib/domain/sessions";
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
  /** Billing order; null for crew, and -1 for people added by hand. */
  order: number | null;
}

/** A person offered while typing a name: from the user's own history or from the catalogue. */
export interface PersonPick {
  /** Our id for them, or null for someone only the catalogue knows so far. */
  personId: string | null;
  tmdbId: number | null;
  name: string;
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
  /** The title's IMDb score (TMDB's when there is none), which the map sorts by. */
  publicScore: number | null;
  /** When the title came out (a year or a full date). */
  releaseDate: string | null;
  /** Movie, TV Show, Concert or Live Event. */
  category: string;
  watchedAt: string | null;
  auditorium: string | null;
  seats: SeatDetail[];
  totalTickets: number | null;
  primaryFormat: string | null;
  addons: string[];
  /** What kind of place the viewing was at; the map shows one pin per kind. */
  venueType: string;
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

/** How many viewings of one kind happened at a venue; `category` is a movie kind or, for a pin, a venue type. */
export interface KindCount {
  category: string;
  count: number;
}

/** A venue the user has used before, offered while typing a venue name or address. */
export interface OwnVenue {
  id: string;
  name: string;
  address: string | null;
  type: string;
  /** The kind of place it was the last time it was used, and the day of that last viewing (null when never used). */
  lastType: string | null;
  lastWatchedOn: string | null;
}

/** A venue with a position, for the map. */
export interface VenuePoint {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  count: number;
  type: string;
  /** Viewings per kind of thing watched (movie, concert...), for the sheet's tabs. */
  kinds: KindCount[];
  /** Viewings per kind of place (cinema, home, concert hall...): the map draws one pin for each. */
  types: KindCount[];
}

/** Everything linked from a title: its credits, the people, their other work, and venues. */
export interface BrowseRepository {
  titleCredits(mediaId: string): Promise<Result<TitleCredits>>;
  person(id: string): Promise<Result<PersonDetail>>;
  /** People already in the log (entered by hand or from the catalogue) whose name contains the text. */
  searchPeople(query: string): Promise<Result<PersonPick[]>>;
  /** Our own id for a person TMDB knows, or null if they are not saved yet. */
  personIdByTmdb(tmdbId: number): Promise<Result<string | null>>;
  /** Related people saved from an earlier look at this person; null when there is none yet. */
  savedRelated(tmdbId: number): Promise<Result<PersonPick[] | null>>;
  saveRelated(tmdbId: number, people: PersonPick[]): Promise<Result<void>>;
  /** People who share titles with this person in the user's own log, most shared first. */
  relatedFromLog(personId: string): Promise<Result<PersonPick[]>>;
  venue(id: string): Promise<Result<VenueDetail>>;
  venuePoints(): Promise<Result<VenuePoint[]>>;
  /** Venues that have no position yet. */
  /** Own venues whose name, address or city contains the text, the ones watched at most recently first. */
  searchVenues(query: string): Promise<Result<OwnVenue[]>>;
  /** The home used most recently, or null if none has been used. */
  lastHome(): Promise<Result<OwnVenue | null>>;
  unlocatedVenues(limit: number): Promise<Result<{ id: string; name: string; address: string | null }[]>>;
  setVenueLocation(id: string, point: GeoPoint): Promise<Result<void>>;
}
