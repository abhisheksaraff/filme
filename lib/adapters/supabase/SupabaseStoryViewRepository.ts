// lib/adapters/supabase/SupabaseStoryViewRepository.ts
// Which Home stories were watched to the end.
import { fail, ok } from "@/lib/ports/result";
import type { StoryViewRepository } from "@/lib/ports/storyViews";
import { getSupabase } from "./client";

export const supabaseStoryViewRepository: StoryViewRepository = {
  async finished() {
    const { data, error } = await getSupabase().from("story_views").select("kind, period, finished_at").order("finished_at", { ascending: false }).limit(30);
    if (error) return fail("Could not load your stories.");
    return ok(data.map((r) => ({ kind: r.kind as string, period: r.period as string, at: r.finished_at as string })));
  },

  async markFinished(kind, period) {
    // The first time counts; the date is not changed by watching it again.
    const { error } = await getSupabase().from("story_views").upsert({ kind, period }, { onConflict: "user_id,kind,period", ignoreDuplicates: true });
    return error ? fail("Could not save that.") : ok(undefined);
  },
};
