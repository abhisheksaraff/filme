// lib/adapters/supabase/venues.ts
// Venue lookups shared by saving a viewing and by the venue suggestions.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnVenue } from "@/lib/ports/browse";

const one = <T>(value: unknown): T | null => ((Array.isArray(value) ? value[0] : value) as T | undefined) ?? null;

/** Escapes % and _ so a typed name is matched literally by ILIKE. */
export const literal = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The home watched at most recently (by the day watched, then by when it was saved), or the newest home if none has been used yet. */
export async function lastHomeVenue(db: SupabaseClient): Promise<OwnVenue | null> {
  const used = await db
    .from("watch_sessions")
    .select("watched_on, venue:venues!inner(id, name, address, type)")
    .eq("venue.type", "home")
    .is("deleted_at", null)
    .order("watched_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const venue = one<{ id: string; name: string; address: string | null; type: string }>(used.data?.[0]?.venue);
  if (venue) return { ...venue, lastType: "home", lastWatchedOn: (used.data?.[0]?.watched_on as string | null) ?? null };

  const newest = await db.from("venues").select("id, name, address, type").eq("type", "home").order("created_at", { ascending: false }).limit(1);
  const row = newest.data?.[0] as { id: string; name: string; address: string | null; type: string } | undefined;
  return row ? { ...row, lastType: null, lastWatchedOn: null } : null;
}
