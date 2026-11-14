// lib/domain/lists.ts
import { z } from "zod";
import { idSchema, timestampSchema } from "./primitives";

export const wantToWatchSchema = z.object({
  id: idSchema,
  mediaId: idSchema,
  note: z.string().nullable(),
  addedAt: timestampSchema,
});
export type WantToWatch = z.infer<typeof wantToWatchSchema>;

export const collectionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  /** Set when the collection belongs to a holiday theme, so it can be surfaced seasonally. */
  holidayId: idSchema.nullable(),
  createdAt: timestampSchema,
});
export type Collection = z.infer<typeof collectionSchema>;
