// types/watchSession.ts
// Interim shim: the format lists now live in lib/domain/formats.ts. This file goes away in Step 2.
import { PRIMARY_FORMATS, FORMAT_ADDONS, type PrimaryFormat, type FormatAddon } from "@/lib/domain/formats";
export { PRIMARY_FORMATS, FORMAT_ADDONS } from "@/lib/domain/formats";
export type { PrimaryFormat, FormatAddon } from "@/lib/domain/formats";

/**
 * Individual Structured Seat Detail
 * Captures discrete section, row, and seat identifier per ticket.
 */
export interface SeatDetail {
  section?: string | null;       // Seating section/tier (e.g., "Sec 102", "Floor A")
  row?: string | null;           // Seating row (e.g., "Row G", "Row 12")
  seat?: string | null;          // Specific seat designation (e.g., "12", "A-15")
}

/**
 * Final Extraction Schema
 * Used strictly for theater, concert, and event tickets. 
 * Unparseable fields map strictly to null or empty arrays.
 */
export interface ExtractedData {
  // Media / Event Identification
  category?: 'Movie' | 'TV Show' | 'Concert' | 'Live Event' | 'Unknown' | null;
  title: string | null;          // Media, movie title, or event/artist name (null if unparseable)

  // TV Specific
  season?: number | null;        // Season number (e.g., 2), or null/undefined for movies/events
  episode?: number | null;       // Episode number (e.g., 5), or null/undefined for movies/events
  episodeTitle?: string | null;  // Optional episode title (e.g., "Battle of the Bastards")

  // Venue & Location
  location?: string | null;      // Theater, venue, platform, or home (e.g., "AMC Village 7", "Scotiabank Arena", "Netflix")
  address?: string | null;       // Physical address for map rendering (null for home/digital)
  auditorium?: string | null;    // Screen/Room/Hall (e.g., "Auditorium 4", "Main Stage")

  // Timing & Tickets
  date?: string | null;          // YYYY-MM-DD format, or null
  time?: string | null;          // HH:mm (24hr) or "7:30 PM", or null
  seats?: SeatDetail[];          // Granular array supporting unique section/row per seat
  totalTickets?: number;         // Ticket count, or 0/1 for home viewings

  // Cinema Specific Formats
  primaryFormat?: PrimaryFormat; // Core format (defaults to "Standard", "Home Viewing", or "Unknown")
  addons?: FormatAddon[];        // Tech or event modifiers, or []
}

/**
 * Default ExtractedData object used as a fallback or baseline state.
 */
export const DEFAULT_EXTRACTED_DATA: ExtractedData = {
  // Media / Event Identification
  category: null,
  title: null,

  // TV Specific
  season: null,
  episode: null,
  episodeTitle: null,

  // Venue & Location
  location: null,
  address: null,
  auditorium: null,

  // Timing & Tickets
  date: null,
  time: null,
  seats: [],
  totalTickets: 1,

  // Cinema Specific Formats
  primaryFormat: 'Standard',
  addons: [],
};

/**
 * AI Structured Outputs JSON Schema for Gemini
 */
export const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    // Media / Event Identification
    category: {
      type: 'STRING',
      enum: ['Movie', 'TV Show', 'Concert', 'Live Event'],
      description: 'Inferred type of ticket/event. Set to null if unidentified.',
      nullable: true
    },
    title: { 
      type: 'STRING', 
      description: 'Media title, movie title, or concert/artist name. MUST be null if unidentified or unparseable.', 
      nullable: true 
    },

    // TV Specific
    season: { type: 'INTEGER', description: 'Season number or null', nullable: true },
    episode: { type: 'INTEGER', description: 'Episode number or null', nullable: true },
    episodeTitle: { type: 'STRING', description: 'Optional episode title', nullable: true },

    // Venue & Location
    location: { type: 'STRING', description: 'Theater, venue, stadium, or platform name', nullable: true },
    address: { type: 'STRING', description: 'Full physical street address of the venue', nullable: true },
    auditorium: { type: 'STRING', description: 'Screen, room, hall, or stage (e.g., "Auditorium 4", "Main Stage")', nullable: true },

    // Timing & Tickets
    date: { type: 'STRING', description: 'YYYY-MM-DD format or null', nullable: true },
    time: { type: 'STRING', description: 'HH:mm or "7:30 PM" or null', nullable: true },
    seats: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          section: { type: 'STRING', description: 'Section for this specific seat', nullable: true },
          row: { type: 'STRING', description: 'Row for this specific seat', nullable: true },
          seat: { type: 'STRING', description: 'Seat number or code', nullable: true }
        }
      },
      description: 'Array of seating details for each ticket',
    },
    totalTickets: { type: 'INTEGER', description: 'Total ticket count or 1', nullable: true },

    // Cinema Specific Formats
    primaryFormat: { 
      type: 'STRING', 
      enum: PRIMARY_FORMATS, 
      description: 'Core format brand or venue type',
      nullable: true
    },
    addons: {
      type: 'ARRAY',
      items: { 
        type: 'STRING', 
        enum: FORMAT_ADDONS 
      },
      description: 'Tech or event modifiers array',
    },
  },
};

/**
 * Shared Canonical Media Metadata (Cached from External APIs)
 */
export interface MediaItem {
  id?: string | null;                   // Internal DB UUID
  tmdbId?: number | null;               // TMDB unique identifier
  imdbId?: string | null;               // IMDb identifier string
  tvdbId?: string | null;               // TVDB identifier string
  category?: 'Movie' | 'TV Show' | 'Concert' | 'Live Event' | 'Unknown' | null;
  title?: string | null;                // Canonical title
  originalLanguage?: string | null;     // Language code (e.g. "en", "ja")
  releaseYear?: number | null;          // Original release year
  runtime?: number | null;              // Runtime/duration in minutes
  voteAverage?: number | null;          // External rating average (e.g. 8.3)
  voteCount?: number | null;            // Total external rating votes
  genres?: string[] | null;             // e.g. ["Action", "Sci-Fi"]
  directors?: string[] | null;          // Director names
  producers?: string[] | null;          // Producer names
  cast?: string[] | null;               // Top actors
  posterPaths?: string[] | null;        // Array of all poster image paths from TMDB
  backdropPaths?: string[] | null;      // Array of all backdrop image paths from TMDB
  overview?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Primary User Log Entry (Database Watch Session)
 * Extends ExtractedData so all parsed ticket fields are inherited automatically.
 */
export interface WatchSession extends ExtractedData {
  id?: string | null;                   // Watch session unique ID
  userId?: string | null;               // User identifier
  
  // --- Relational Reference ---
  mediaId?: string | null;              // Foreign Key -> MediaItem.id (UUID)
  mediaItem?: MediaItem | null;         // Expanded object join for UI

  // --- Personal Logs & Media Attachments ---
  rating?: number | null;               // User score (1-5 or 1-10)
  notes?: string | null;                // Personal review text
  ticketImages?: string[] | null;       // Paths for stubs/digital receipts
  additionalImages?: string[] | null;   // Paths for selfies/photos

  // --- System Audit Fields ---
  createdAt?: string | null;
  updatedAt?: string | null;
}