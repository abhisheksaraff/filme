// lib/domain/images.ts
import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives";

export const IMAGE_KINDS = ["poster", "backdrop", "ticket", "photo", "profile", "avatar"] as const;
export const imageKindSchema = z.enum(IMAGE_KINDS);

/** Where the file lives: TMDB's CDN or the user's own Supabase Storage bucket. */
export const imageSourceSchema = z.enum(["tmdb", "upload"]);

export const imageSchema = z.object({
  id: idSchema,
  kind: imageKindSchema,
  source: imageSourceSchema,
  path: z.string().min(1),
  note: z.string().nullable(),
  isDefault: z.boolean(),
  mediaId: idSchema.nullable(),
  sessionId: idSchema.nullable(),
  personId: idSchema.nullable(),
  createdAt: timestampSchema,
});
export type MediaImage = z.infer<typeof imageSchema>;
