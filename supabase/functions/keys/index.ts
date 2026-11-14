// supabase/functions/keys/index.ts
// Adds, removes, reorders and tests the user's API keys. Keys go into Vault and never come back out.
import { adminClient, enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { AI_PROVIDERS, isProvider, loadSlots, PROVIDERS, validateKey } from "../_shared/providers.ts";

const DAILY_LIMIT = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, "That key id is not valid.");
  return value;
}

function cleanModels(provider: string, value: unknown): string[] {
  if (provider === "tmdb") return [];
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
    throw new HttpError(400, "Add between 1 and 8 model names for an AI key.");
  }
  return value.map((model) => {
    if (typeof model !== "string" || !/^[A-Za-z0-9._:/-]{1,80}$/.test(model)) {
      throw new HttpError(400, "A model name contains characters that are not allowed.");
    }
    return model;
  });
}

serve(async (req) => {
  const { userId } = await requireUser(req);
  await enforceLimit(userId, "keys", DAILY_LIMIT);
  const body = await readJson(req);
  const db = adminClient();

  switch (body.action) {
    case "add": {
      if (!isProvider(body.provider)) throw new HttpError(400, `Provider must be one of: ${PROVIDERS.join(", ")}.`);
      const secret = typeof body.secret === "string" ? body.secret.trim() : "";
      // Real keys are printable ASCII with no spaces; this rejects pasted text with stray characters.
      if (!/^[\x21-\x7E]{8,600}$/.test(secret)) throw new HttpError(400, "That does not look like an API key.");
      const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null;
      const models = cleanModels(body.provider, body.models);

      // Refuse keys the provider rejects, so a typo is caught now rather than at the next scan.
      const check = await validateKey(body.provider, secret);
      if (!check.ok) throw new HttpError(422, check.message);

      const { data, error } = await db.rpc("app_add_api_key", {
        p_user: userId,
        p_provider: body.provider,
        p_label: label,
        p_models: models,
        p_secret: secret,
      });
      if (error) throw new HttpError(500, error.message.includes("Too many") ? "Too many keys saved (limit 20)." : "Could not save the key.");
      return { id: data, message: check.message };
    }

    case "remove": {
      const { error } = await db.rpc("app_remove_api_key", { p_user: userId, p_id: requireId(body.id) });
      if (error) throw new HttpError(500, "Could not remove the key.");
      return { removed: true };
    }

    case "reorder": {
      if (!Array.isArray(body.ids) || body.ids.length > 20) throw new HttpError(400, "ids must be a list.");
      const { error } = await db.rpc("app_reorder_api_keys", { p_user: userId, p_ids: body.ids.map(requireId) });
      if (error) throw new HttpError(500, "Could not reorder the keys.");
      return { reordered: true };
    }

    case "test": {
      // One key when an id is given, otherwise every saved key.
      const slots = await loadSlots(userId, PROVIDERS, body.id === undefined ? undefined : requireId(body.id));
      const results = [];
      for (const slot of slots) {
        const check = await validateKey(slot.provider, slot.secret);
        results.push({
          id: slot.id,
          provider: slot.provider,
          ok: check.ok,
          message: check.message,
          isAi: (AI_PROVIDERS as readonly string[]).includes(slot.provider),
        });
      }
      return { results };
    }

    default:
      throw new HttpError(400, "Unknown action.");
  }
});
