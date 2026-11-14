// supabase/functions/keys/index.ts
// Manages the user's API keys, each AI provider's model list, and the provider order.
// Keys go into Vault and never come back out.
import { adminClient, enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { AI_PROVIDERS, isProvider, loadSlots, PROVIDERS, validateKey, type AiProvider } from "../_shared/providers.ts";

const DAILY_LIMIT = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, "That id is not valid.");
  return value;
}

function requireAiProvider(value: unknown): AiProvider {
  if (typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value)) return value as AiProvider;
  throw new HttpError(400, `Provider must be one of: ${AI_PROVIDERS.join(", ")}.`);
}

function requireIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, "ids must be a list.");
  return value.map(requireId);
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

      // Refuse keys the provider rejects, so a typo is caught now rather than at the next scan.
      const check = await validateKey(body.provider, secret);
      if (!check.ok) throw new HttpError(422, check.message);

      const { data, error } = await db.rpc("app_add_api_key", {
        p_user: userId,
        p_provider: body.provider,
        p_label: label,
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
      const { error } = await db.rpc("app_reorder_api_keys", { p_user: userId, p_ids: requireIds(body.ids) });
      if (error) throw new HttpError(500, "Could not reorder the keys.");
      return { reordered: true };
    }

    case "test": {
      // One key when an id is given, otherwise every saved key.
      const slots = await loadSlots(userId, PROVIDERS, body.id === undefined ? undefined : requireId(body.id));
      const results = [];
      for (const slot of slots) {
        const check = await validateKey(slot.provider, slot.secret);
        results.push({ id: slot.id, provider: slot.provider, ok: check.ok, message: check.message });
      }
      return { results };
    }

    case "addModel": {
      const provider = requireAiProvider(body.provider);
      const model = typeof body.model === "string" ? body.model.trim() : "";
      if (!/^[A-Za-z0-9._:/-]{1,80}$/.test(model)) throw new HttpError(400, "That model name contains characters that are not allowed.");
      const { error } = await db.rpc("app_add_model", { p_user: userId, p_provider: provider, p_model: model });
      if (error) {
        if (error.message.includes("Too many")) throw new HttpError(400, "Too many models (limit 20 per provider).");
        if (error.code === "23505") throw new HttpError(409, "That model is already in the list.");
        throw new HttpError(500, "Could not add the model.");
      }
      return { added: true };
    }

    case "removeModel": {
      const { error } = await db.rpc("app_remove_model", { p_user: userId, p_id: requireId(body.id) });
      if (error) throw new HttpError(500, "Could not remove the model.");
      return { removed: true };
    }

    case "reorderModels": {
      const { error } = await db.rpc("app_reorder_models", {
        p_user: userId,
        p_provider: requireAiProvider(body.provider),
        p_ids: requireIds(body.ids),
      });
      if (error) throw new HttpError(500, "Could not reorder the models.");
      return { reordered: true };
    }

    case "reorderProviders": {
      if (!Array.isArray(body.providers) || body.providers.length > AI_PROVIDERS.length) {
        throw new HttpError(400, "providers must be a list.");
      }
      const providers = [...new Set(body.providers.map(requireAiProvider))];
      const { error } = await db.rpc("app_reorder_providers", { p_user: userId, p_providers: providers });
      if (error) throw new HttpError(500, "Could not reorder the providers.");
      return { reordered: true };
    }

    default:
      throw new HttpError(400, "Unknown action.");
  }
});
