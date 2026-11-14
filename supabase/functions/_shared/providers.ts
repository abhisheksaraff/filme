// supabase/functions/_shared/providers.ts
// Everything that knows how to talk to a key's provider: which providers exist, how to test a
// key, and how to load the saved keys from Vault.
import { adminClient } from "./auth.ts";
import { HttpError } from "./http.ts";

export const AI_PROVIDERS = ["gemini", "openai", "claude"] as const;
export const PROVIDERS = [...AI_PROVIDERS, "tmdb"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export interface KeySlot {
  id: string;
  provider: Provider;
  label: string | null;
  secret: string;
}

/** One AI provider with its models and keys, both in the user's chosen order. */
export interface ProviderPlan {
  provider: AiProvider;
  models: string[];
  keys: KeySlot[];
}

/** Decrypted keys for the given providers, in the user's fallback order. */
export async function loadSlots(userId: string, providers: readonly Provider[], id?: string): Promise<KeySlot[]> {
  const { data, error } = await adminClient().rpc("app_get_api_secrets", {
    p_user: userId,
    p_providers: providers,
    p_id: id ?? null,
  });
  if (error) throw new HttpError(500, "Could not read saved keys.");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    provider: row.provider as Provider,
    label: (row.label as string | null) ?? null,
    secret: row.secret as string,
  }));
}

export interface KeyCheck {
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 10_000;

/** Tells the key's provider "who am I?" with the cheapest read-only request it offers. */
export async function validateKey(provider: Provider, secret: string): Promise<KeyCheck> {
  let request: Promise<Response>;
  switch (provider) {
    case "gemini":
      request = fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
        headers: { "x-goog-api-key": secret },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      break;
    case "openai":
      request = fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      break;
    case "claude":
      request = fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": secret, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      break;
    case "tmdb": {
      // TMDB issues two kinds of credential: a v4 read token (a JWT) or a v3 key.
      const bearer = secret.startsWith("eyJ");
      const url = bearer
        ? "https://api.themoviedb.org/3/authentication"
        : `https://api.themoviedb.org/3/authentication?api_key=${encodeURIComponent(secret)}`;
      request = fetch(url, {
        headers: bearer ? { Authorization: `Bearer ${secret}` } : {},
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      break;
    }
  }

  try {
    const res = await request;
    await res.body?.cancel();
    if (res.ok) return { ok: true, message: "Key works." };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "The provider rejected this key." };
    if (res.status === 429) return { ok: true, message: "Key looks valid, but the provider is rate limiting it right now." };
    return { ok: false, message: `The provider answered with status ${res.status}.` };
  } catch {
    return { ok: false, message: "Could not reach the provider." };
  }
}

/**
 * The order to try things in for an AI call: providers by the user's order (unlisted ones last,
 * in default order), each with its saved models and keys. Providers without keys are left out.
 */
export async function loadAiPlan(userId: string): Promise<ProviderPlan[]> {
  const db = adminClient();
  const [slots, modelRows, orderRows] = await Promise.all([
    loadSlots(userId, AI_PROVIDERS),
    db.from("provider_models").select("provider, model").eq("user_id", userId).order("sort_order"),
    db.from("provider_order").select("provider, sort_order").eq("user_id", userId).order("sort_order"),
  ]);
  if (modelRows.error || orderRows.error) throw new HttpError(500, "Could not read provider settings.");

  const chosen = (orderRows.data ?? []).map((r) => r.provider as AiProvider);
  const ordered = [...chosen, ...AI_PROVIDERS.filter((p) => !chosen.includes(p))];

  return ordered
    .map((provider) => ({
      provider,
      models: (modelRows.data ?? []).filter((m) => m.provider === provider).map((m) => m.model as string),
      keys: slots.filter((k) => k.provider === provider),
    }))
    .filter((plan) => plan.keys.length > 0);
}
