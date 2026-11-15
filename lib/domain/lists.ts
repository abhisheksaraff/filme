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
