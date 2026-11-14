// lib/adapters/supabase/SupabaseNotificationRepository.ts
// Home banners (monthly and yearly reports, backup reminder), stored so dismissing sticks everywhere.
import type { NotificationRepository } from "@/lib/ports/notifications";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

export const supabaseNotificationRepository: NotificationRepository = {
  async active() {
    const { data, error } = await getSupabase()
      .from("notifications")
      .select("id, kind, body, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return fail("Could not load notifications.");
    return ok(
      data.map((row) => ({
        id: row.id as string,
        kind: row.kind as string,
        period: String((row.body as { period?: string })?.period ?? ""),
        createdAt: row.created_at as string,
      })),
    );
  },

  async ensure(kind, period) {
    const db = getSupabase();
    // A dismissed notification still counts as existing, so it is never created a second time.
    const found = await db.from("notifications").select("id").eq("kind", kind).contains("body", { period }).limit(1);
    if (found.error) return fail("Could not check notifications.");
    if (found.data.length > 0) return ok(undefined);
    const { error } = await db.from("notifications").insert({ kind, body: { period } });
    return error ? fail("Could not create the notification.") : ok(undefined);
  },

  async dismiss(id) {
    const { error } = await getSupabase().from("notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    return error ? fail("Could not dismiss that.") : ok(undefined);
  },
};
