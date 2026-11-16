// supabase/functions/keys/index.ts
// Manages the user's API keys, each AI provider's model list, and the provider order.
// Keys go into Vault and never come back out.
import { adminClient, enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { AI_PROVIDERS, isProvider, loadSlots, PROVIDERS, recordKeyResult, validateKey, type AiProvider } from "../_shared/providers.ts";

const DAILY_LIMIT = 300;
const MAX_KEYS = 20;
const MAX_MODELS = 20;
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
    case "addKeys": {
      if (!isProvider(body.provider)) throw new HttpError(400, `Provider must be one of: ${PROVIDERS.join(", ")}.`);
      const provider = body.provider;
      if (!Array.isArray(body.secrets) || body.secrets.length === 0 || body.secrets.length > MAX_KEYS) {
        throw new HttpError(400, `Send between 1 and ${MAX_KEYS} keys.`);
      }
      const secrets = body.secrets.map((s) => (typeof s === "string" ? s.trim() : ""));

      const { count, error: countError } = await db
        .from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (countError) throw new HttpError(500, "Could not check how many keys are saved.");
      if ((count ?? 0) + secrets.length > MAX_KEYS) throw new HttpError(400, `Too many keys saved (limit ${MAX_KEYS}).`);

      // Check every key before saving any, so a typo on one line never leaves a half-saved list.
      const problems = (
        await Promise.all(
          secrets.map(async (secret, i) => {
            // Real keys are printable ASCII with no spaces; this rejects pasted text with stray characters.
            if (!/^[\x21-\x7E]{8,600}$/.test(secret)) return `Key ${i + 1}: does not look like an API key.`;
            const check = await validateKey(provider, secret);
            return check.ok ? null : `Key ${i + 1}: ${check.message}`;
          }),
        )
      ).filter((line): line is string => line !== null);
      if (problems.length > 0) throw new HttpError(422, `${problems.join(" ")} Nothing was saved.`);

      // One at a time so the saved order matches the order they were typed.
      for (const secret of secrets) {
        const { data: newId, error } = await db.rpc("app_add_api_key", { p_user: userId, p_provider: provider, p_label: null, p_secret: secret });
        if (error) throw new HttpError(500, "Could not save a key.");
        // It was checked a moment ago, so it starts with a tick.
        if (typeof newId === "string") await recordKeyResult(userId, newId, true, "Key works.", true);
      }
      return { added: secrets.length };
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
        await recordKeyResult(userId, slot.id, check.ok, check.message, true);
      }
      return { results };
    }

    case "setModels": {
      const provider = requireAiProvider(body.provider);
      if (!Array.isArray(body.models) || body.models.length > MAX_MODELS) {
        throw new HttpError(400, `Send at most ${MAX_MODELS} models.`);
      }
      const models = [...new Set(body.models.map((m) => (typeof m === "string" ? m.trim() : "")))];
      if (models.some((m) => !/^[A-Za-z0-9._:/-]{1,80}$/.test(m))) {
        throw new HttpError(400, "A model name contains characters that are not allowed.");
      }

      // Make the saved list match the one sent: drop what is gone, add what is new, then fix the order.
      const read = () => db.from("provider_models").select("id, model").eq("user_id", userId).eq("provider", provider);
      const { data: current, error: readError } = await read();
      if (readError) throw new HttpError(500, "Could not read the model list.");

      const wanted = new Set(models);
      for (const row of current ?? []) {
        if (wanted.has(row.model)) continue;
        const { error } = await db.rpc("app_remove_model", { p_user: userId, p_id: row.id });
        if (error) throw new HttpError(500, "Could not remove a model.");
      }
      const have = new Set((current ?? []).map((row) => row.model));
      for (const model of models) {
        if (have.has(model)) continue;
        const { error } = await db.rpc("app_add_model", { p_user: userId, p_provider: provider, p_model: model });
        if (error) throw new HttpError(500, "Could not add a model.");
      }

      const { data: after, error: afterError } = await read();
      if (afterError) throw new HttpError(500, "Could not read the model list.");
      const idByName = new Map((after ?? []).map((row) => [row.model as string, row.id as string]));
      const ids = models.map((m) => idByName.get(m)).filter((id): id is string => id !== undefined);
      const { error } = await db.rpc("app_reorder_models", { p_user: userId, p_provider: provider, p_ids: ids });
      if (error) throw new HttpError(500, "Could not reorder the models.");
      return { saved: models.length };
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
