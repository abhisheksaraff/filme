// lib/files.ts
// Chooses where image files are kept. To move to a different store, change `activeStore`; every
// image remembers its own store, so older images keep working until they are moved.
import { edgeFileStore } from "@/lib/adapters/files/EdgeFileStore";
import { supabaseFileStore } from "@/lib/adapters/supabase/SupabaseFileStore";
import type { FileStore, StoreId } from "@/lib/ports/files";
import { fail, ok, type Result } from "@/lib/ports/result";

/** New ticket stubs, photos and profile pictures are written here. */
export const activeStore: FileStore = edgeFileStore;

const STORES: Record<StoreId, FileStore> = { supabase: supabaseFileStore, files: edgeFileStore };

/** The store an image row says it lives in. */
export const storeFor = (id: unknown): FileStore => STORES[id as StoreId] ?? supabaseFileStore;

export const allStores: FileStore[] = [supabaseFileStore, edgeFileStore];

/**
 * Saves a new file in the active store, or in Supabase Storage if that store cannot be reached, so
 * logging a viewing never fails because of the image store. Returns the store that took it; the
 * image is moved over later by the background move.
 */
export async function putWithFallback(path: string, blob: Blob): Promise<Result<FileStore>> {
  const first = await activeStore.put(path, blob);
  if (first.ok) return ok(activeStore);
  if (activeStore.id === "supabase") return fail(first.error);
  const second = await supabaseFileStore.put(path, blob);
  return second.ok ? ok(supabaseFileStore) : fail(first.error);
}
