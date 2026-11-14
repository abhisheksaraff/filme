// lib/tmdbClient.ts
import { CredentialsModel } from '@/lib/credentialsModel';
import { MediaItem } from '@/types/watchSession';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

/**
 * Validates a TMDB API Key or Bearer Read Token against the TMDB /authentication endpoint
 */
export async function validateApiKey(testKey?: string): Promise<boolean> {
  const key = testKey || (await CredentialsModel.getKey('tmdb'));
  if (!key) return false;

  try {
    const isBearerToken = key.startsWith('eyJ');
    const url = isBearerToken
      ? `${TMDB_BASE_URL}/authentication`
      : `${TMDB_BASE_URL}/authentication?api_key=${key}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(isBearerToken ? { Authorization: `Bearer ${key}` } : {}),
    };

    const response = await fetch(url, { method: 'GET', headers });
    return response.ok;
  } catch (error) {
    console.warn('[TMDBClient] Key validation failed:', error);
    return false;
  }
}

/**
 * Resolves TMDB key and returns appropriate fetch options (Headers and URL modifier)
 */
async function getTmdbAuth() {
  const key = await CredentialsModel.getKey('tmdb');

  if (!key) {
    throw new Error('TMDB API Key or Read Access Token is missing from CredentialsModel.');
  }

  // Check if key is a v4 Bearer Read Token (JWTs start with "eyJ")
  const isBearerToken = key.startsWith('eyJ');

  return {
    key,
    isBearerToken,
    headers: {
      'Content-Type': 'application/json',
      ...(isBearerToken ? { Authorization: `Bearer ${key}` } : {}),
    },
  };
}

/**
 * Builds full TMDB URL, appending api_key query param ONLY if not using a Bearer token
 */
async function buildUrl(endpoint: string, params: Record<string, string> = {}): Promise<{ url: string; headers: HeadersInit }> {
  const { key, isBearerToken, headers } = await getTmdbAuth();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  if (!isBearerToken) {
    url.searchParams.append('api_key', key);
  }

  Object.entries(params).forEach(([k, v]) => {
    url.searchParams.append(k, v);
  });

  return { url: url.toString(), headers };
}

/**
 * Helper to construct full TMDB image URLs
 */
const getImageUrl = (path?: string | null): string | null => 
  path ? `${TMDB_IMAGE_BASE}${path}` : null;

// ==========================================
// Search Interfaces
// ==========================================
export interface TMDBSearchMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  media_type?: 'movie';
}

export interface TMDBSearchTVResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  media_type?: 'tv';
}

export interface TMDBSearchPersonResult {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: Array<TMDBSearchMovieResult | TMDBSearchTVResult>;
  media_type?: 'person';
}

export type TMDBSearchMultiResult =
  | (TMDBSearchMovieResult & { media_type: 'movie' })
  | (TMDBSearchTVResult & { media_type: 'tv' })
  | (TMDBSearchPersonResult & { media_type: 'person' });

export interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ==========================================
// 1. Search Functions
// ==========================================

export async function getClosestMatch(
  term: string,
  category?: 'Movie' | 'TV Show' | 'Person' | string | null
): Promise<TMDBSearchMultiResult | TMDBSearchMovieResult | TMDBSearchTVResult | TMDBSearchPersonResult | null> {
  if (!term || !term.trim()) return null;

  const normalizedCategory = category?.toLowerCase().trim();

  if (normalizedCategory === 'movie') {
    const res = await searchMovies(term);
    const topResult = res.results[0];
    return topResult ? { ...topResult, media_type: 'movie' } : null;
  }

  if (normalizedCategory === 'tv show' || normalizedCategory === 'tv') {
    const res = await searchTVShows(term);
    const topResult = res.results[0];
    return topResult ? { ...topResult, media_type: 'tv' } : null;
  }

  if (normalizedCategory === 'person' || normalizedCategory === 'actor') {
    const res = await searchPeople(term);
    const topResult = res.results[0];
    return topResult ? { ...topResult, media_type: 'person' } : null;
  }

  // Fallback: Query all media types using searchMulti
  const res = await searchMulti(term);
  return res.results[0] || null;
}

export async function searchMovies(query: string, page = 1): Promise<TMDBSearchResponse<TMDBSearchMovieResult>> {
  const { url, headers } = await buildUrl('/search/movie', {
    query,
    page: page.toString(),
    include_adult: 'false',
  });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB Movie Search failed: ${res.statusText}`);
  return res.json();
}

export async function searchTVShows(query: string, page = 1): Promise<TMDBSearchResponse<TMDBSearchTVResult>> {
  const { url, headers } = await buildUrl('/search/tv', {
    query,
    page: page.toString(),
    include_adult: 'false',
  });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB TV Search failed: ${res.statusText}`);
  return res.json();
}

export async function searchPeople(query: string, page = 1): Promise<TMDBSearchResponse<TMDBSearchPersonResult>> {
  const { url, headers } = await buildUrl('/search/person', {
    query,
    page: page.toString(),
    include_adult: 'false',
  });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB Person Search failed: ${res.statusText}`);
  return res.json();
}

export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResponse<TMDBSearchMultiResult>> {
  const { url, headers } = await buildUrl('/search/multi', {
    query,
    page: page.toString(),
    include_adult: 'false',
  });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB Multi Search failed: ${res.statusText}`);
  return res.json();
}

// ==========================================
// 2. Get Movie Details
// ==========================================
export interface TMDBMovieDetails {
  id: number;
  imdb_id?: string;
  title: string;
  overview: string;
  tagline: string;
  status: string;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  original_language: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string }>;
  credits?: {
    cast: Array<{ name: string }>;
    crew: Array<{ name: string; job: string }>;
  };
}

export async function getMovieDetails(movieId: number | string): Promise<Partial<MediaItem>> {
  const { url, headers } = await buildUrl(`/movie/${movieId}`, { append_to_response: 'credits' });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB Movie fetch failed: ${res.statusText}`);

  const data: TMDBMovieDetails = await res.json();

  const directors = data.credits?.crew
    .filter((person) => person.job === 'Director')
    .map((person) => person.name) || [];

  const producers = data.credits?.crew
    .filter((person) => person.job === 'Producer' || person.job === 'Executive Producer')
    .map((person) => person.name) || [];

  const cast = data.credits?.cast.slice(0, 10).map((person) => person.name) || [];

  return {
    tmdbId: data.id,
    imdbId: data.imdb_id || null,
    category: 'Movie',
    title: data.title,
    overview: data.overview || null,
    runtime: data.runtime || null,
    releaseYear: data.release_date ? parseInt(data.release_date.split('-')[0], 10) : null,
    originalLanguage: data.original_language || null,
    voteAverage: data.vote_average || null,
    voteCount: data.vote_count || null,
    genres: data.genres.map((g) => g.name),
    directors,
    producers,
    cast,
    posterPaths: data.poster_path ? [getImageUrl(data.poster_path)!] : [],
    backdropPaths: data.backdrop_path ? [getImageUrl(data.backdrop_path)!] : [],
  };
}

// ==========================================
// 3. Get TV Show Details
// ==========================================
export interface TMDBTVShowDetails {
  id: number;
  name: string;
  overview: string;
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  original_language: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  created_by: Array<{ id: number; name: string }>;
  aggregate_credits?: {
    cast: Array<{ name: string }>;
  };
}

export async function getTVShowDetails(seriesId: number | string): Promise<Partial<MediaItem> & { totalSeasons: number; status: string }> {
  const { url, headers } = await buildUrl(`/tv/${seriesId}`, { append_to_response: 'aggregate_credits' });

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB TV Show fetch failed: ${res.statusText}`);

  const data: TMDBTVShowDetails = await res.json();

  const cast = data.aggregate_credits?.cast.slice(0, 10).map((person) => person.name) || [];

  return {
    tmdbId: data.id,
    category: 'TV Show',
    title: data.name,
    overview: data.overview || null,
    releaseYear: data.first_air_date ? parseInt(data.first_air_date.split('-')[0], 10) : null,
    originalLanguage: data.original_language || null,
    voteAverage: data.vote_average || null,
    voteCount: data.vote_count || null,
    genres: data.genres.map((g) => g.name),
    directors: data.created_by.map((c) => c.name),
    cast,
    posterPaths: data.poster_path ? [getImageUrl(data.poster_path)!] : [],
    backdropPaths: data.backdrop_path ? [getImageUrl(data.backdrop_path)!] : [],
    totalSeasons: data.number_of_seasons,
    status: data.status,
  };
}

// ==========================================
// 4. Get TV Season Details
// ==========================================
export interface TMDBTVSeasonDetails {
  _id: string;
  id: number;
  name: string;
  overview: string;
  season_number: number;
  poster_path: string | null;
  air_date: string | null;
  episodes: Array<{
    id: number;
    episode_number: number;
    name: string;
    overview: string;
    air_date: string;
    still_path: string | null;
    vote_average: number;
  }>;
}

export async function getTVSeasonDetails(seriesId: number | string, seasonNumber: number) {
  const { url, headers } = await buildUrl(`/tv/${seriesId}/season/${seasonNumber}`);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB TV Season fetch failed: ${res.statusText}`);

  const data: TMDBTVSeasonDetails = await res.json();

  return {
    seasonId: data.id,
    seasonNumber: data.season_number,
    name: data.name,
    overview: data.overview,
    airDate: data.air_date,
    posterPath: getImageUrl(data.poster_path),
    episodeCount: data.episodes.length,
    episodes: data.episodes.map((ep) => ({
      episodeNumber: ep.episode_number,
      title: ep.name,
      overview: ep.overview,
      airDate: ep.air_date,
      stillPath: getImageUrl(ep.still_path),
      voteAverage: ep.vote_average,
    })),
  };
}

// ==========================================
// 5. Get TV Episode Details
// ==========================================
export interface TMDBTVEpisodeDetails {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  guest_stars: Array<{
    id: number;
    name: string;
    character: string;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
  }>;
}

export async function getTVEpisodeDetails(
  seriesId: number | string,
  seasonNumber: number,
  episodeNumber: number
) {
  const { url, headers } = await buildUrl(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB TV Episode fetch failed: ${res.statusText}`);

  const data: TMDBTVEpisodeDetails = await res.json();

  const directors = data.crew
    .filter((c) => c.job === 'Director')
    .map((c) => c.name);

  return {
    episodeId: data.id,
    episodeNumber: data.episode_number,
    seasonNumber: data.season_number,
    title: data.name,
    overview: data.overview,
    runtime: data.runtime,
    airDate: data.air_date,
    stillPath: getImageUrl(data.still_path),
    voteAverage: data.vote_average,
    directors,
    guestStars: data.guest_stars.map((star) => ({
      name: star.name,
      character: star.character,
    })),
  };
}