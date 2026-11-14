// lib/domain/media.ts
import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives";

/** The four kinds of thing the log can hold. */
export const MEDIA_CATEGORIES = ["Movie", "TV Show", "Concert", "Live Event"] as const;
export const mediaCategorySchema = z.enum(MEDIA_CATEGORIES);
export type MediaCategory = z.infer<typeof mediaCategorySchema>;

/** Where a record came from; custom items are ones TMDB does not have. */
export const mediaSourceSchema = z.enum(["tmdb", "custom"]);

/** Roles a person can hold on a title. One person can hold several (actor and director). */
export const PERSON_ROLES = [
  "actor",
  "director",
  "producer",
  "writer",
  "creator",
  "performer",
  "opener",
] as const;
export const personRoleSchema = z.enum(PERSON_ROLES);
export type PersonRole = z.infer<typeof personRoleSchema>;

export const personSchema = z.object({
  id: idSchema,
  tmdbId: z.number().int().nullable(),
  musicbrainzId: z.string().nullable(),
  name: z.string().min(1),
  profilePath: z.string().nullable(),
  updatedAt: timestampSchema,
});
export type Person = z.infer<typeof personSchema>;

/** Link between a title and a person; billing order keeps the cast list in credit order. */
export const creditSchema = z.object({
  person: personSchema,
  role: personRoleSchema,
  character: z.string().nullable(),
  billingOrder: z.number().int().nullable(),
});
export type Credit = z.infer<typeof creditSchema>;

export const genreSchema = z.object({ id: z.number().int(), name: z.string() });
export const keywordSchema = z.object({ id: z.number().int(), name: z.string() });
export const companySchema = z.object({ id: z.number().int(), name: z.string() });

export const seasonSchema = z.object({
  id: idSchema,
  mediaId: idSchema,
  seasonNumber: z.number().int().min(0),
  name: z.string().nullable(),
  episodeCount: z.number().int().nullable(),
  airDate: z.string().nullable(),
});
export type Season = z.infer<typeof seasonSchema>;

export const episodeSchema = z.object({
  id: idSchema,
  seasonId: idSchema,
  episodeNumber: z.number().int().min(0),
  name: z.string().nullable(),
  airDate: z.string().nullable(),
  runtime: z.number().int().nullable(),
});
export type Episode = z.infer<typeof episodeSchema>;

/** A title the log knows about: cached from TMDB or created by hand. */
export const mediaItemSchema = z.object({
  id: idSchema,
  source: mediaSourceSchema,
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  category: mediaCategorySchema,
  title: z.string().min(1),
  originalTitle: z.string().nullable(),
  originalLanguage: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtime: z.number().int().nullable(),
  overview: z.string().nullable(),
  voteAverage: z.number().nullable(),
  voteCount: z.number().int().nullable(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  lastSyncedAt: timestampSchema.nullable(),
  updatedAt: timestampSchema,
});
export type MediaItem = z.infer<typeof mediaItemSchema>;
