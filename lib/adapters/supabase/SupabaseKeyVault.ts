// lib/adapters/supabase/SupabaseKeyVault.ts
// Key metadata is read straight from the table (RLS-protected); every change goes through the `keys` function.
import type { KeySummary, KeyTestResult } from "@/lib/domain/keys";
import type { KeyVault } from "@/lib/ports/keys";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { callFunction } from "./functions";

export const supabaseKeyVault: KeyVault = {
  async list() {
    const { data, error } = await getSupabase()
      .from("api_keys")
      .select("id, provider, label, models, sort_order, hint")
      .order("sort_order");
    if (error) return fail("Could not load your keys.");
    const keys: KeySummary[] = data.map((row) => ({
      id: row.id,
      provider: row.provider,
      label: row.label,
      models: row.models ?? [],
      sortOrder: row.sort_order,
      hint: row.hint,
    }));
    return ok(keys);
  },

  async add(key) {
    const res = await callFunction("keys", { action: "add", ...key });
    return res.ok ? ok(undefined) : res;
  },

  async remove(id) {
    const res = await callFunction("keys", { action: "remove", id });
    return res.ok ? ok(undefined) : res;
  },

  async reorder(ids) {
    const res = await callFunction("keys", { action: "reorder", ids });
    return res.ok ? ok(undefined) : res;
  },

  async test(id) {
    const res = await callFunction<{ results: KeyTestResult[] }>("keys", { action: "test", id });
    return res.ok ? ok(res.value.results) : res;
  },
};
