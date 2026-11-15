// lib/imageMove.ts
// Moves images from Supabase Storage to the active file store a few at a time, whenever Home opens.
// A file is only deleted from Supabase after the copy has been read back and matches.
import { activeStore, storeFor } from "@/lib/files";
import { services } from "@/lib/services";

const BATCH = 6;
/** Custom posters and covers stay in Supabase's public bucket, so they are never moved. */
const MOVES = new Set(["ticket", "photo", "avatar"]);

/** Copies one batch; returns how many images moved. Quiet on failure: the next visit tries again. */
export async function moveLegacyImages(): Promise<number> {
  if (activeStore.id === "supabase") return 0;
  const rows = await services.data.imageRows({ store: "supabase", limit: BATCH * 3 });
  if (!rows.ok) return 0;

  const from = storeFor("supabase");
  let moved = 0;
  for (const row of rows.value.filter((r) => MOVES.has(r.kind)).slice(0, BATCH)) {
    const file = await from.get(row.path);
    if (!file.ok) continue;
    const put = await activeStore.put(row.path, file.value);
    if (!put.ok) continue;
    const check = await activeStore.get(row.path);
    if (!check.ok || check.value.size !== file.value.size) continue;
    const saved = await services.data.setImageStore(row.id, activeStore.id);
    if (!saved.ok) continue;
    await from.remove([row.path]);
    moved++;
  }
  return moved;
}
