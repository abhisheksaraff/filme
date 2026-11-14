// lib/adapters/supabase/SupabaseKeyVault.ts
// Settings are read straight from RLS-protected tables; every change goes through the `keys` function.
import { AI_KEY_PROVIDERS, type AiKeyProvider, type KeyConfig, type KeyTestResult } from "@/lib/domain/keys";
import type { KeyVault } from "@/lib/ports/keys";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";
import { callFunction } from "./functions";

async function change(body: Record<string, unknown>): Promise<Result<void>> {
  const res = await callFunction("keys", body);
  return res.ok ? ok(undefined) : res;
}

export const supabaseKeyVault: KeyVault = {
  async load() {
    const db = getSupabase();
    const [keys, models, order] = await Promise.all([
      db.from("api_keys").select("id, provider, label, sort_order, hint").order("sort_order"),
      db.from("provider_models").select("id, provider, model, sort_order").order("sort_order"),
      db.from("provider_order").select("provider").order("sort_order"),
    ]);
    if (keys.error || models.error || order.error) return fail("Could not load your keys.");

    const ranked = order.data.map((r) => r.provider as AiKeyProvider);
    const config: KeyConfig = {
      keys: keys.data.map((r) => ({
        id: r.id,
        provider: r.provider,
        label: r.label,
        sortOrder: r.sort_order,
        hint: r.hint,
      })),
      models: models.data.map((r) => ({ id: r.id, provider: r.provider, model: r.model, sortOrder: r.sort_order })),
      providerOrder: [...ranked, ...AI_KEY_PROVIDERS.filter((p) => !ranked.includes(p))],
    };
    return ok(config);
  },

  addKey: (key) => change({ action: "add", ...key }),
  removeKey: (id) => change({ action: "remove", id }),
  reorderKeys: (ids) => change({ action: "reorder", ids }),

  async testKeys(id) {
    const res = await callFunction<{ results: KeyTestResult[] }>("keys", { action: "test", id });
    return res.ok ? ok(res.value.results) : res;
  },

  addModel: (provider, model) => change({ action: "addModel", provider, model }),
  removeModel: (id) => change({ action: "removeModel", id }),
  reorderModels: (provider, ids) => change({ action: "reorderModels", provider, ids }),
  reorderProviders: (providers) => change({ action: "reorderProviders", providers }),
};
