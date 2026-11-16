// lib/domain/keys.ts
// Vocabulary for the API keys screen.

export const KEY_PROVIDERS = ["gemini", "openai", "claude", "tmdb", "omdb"] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

/** Providers that read tickets; they have a model list and a place in the fallback order. */
export const AI_KEY_PROVIDERS = ["gemini", "openai", "claude"] as const;
export type AiKeyProvider = (typeof AI_KEY_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<KeyProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Anthropic Claude",
  tmdb: "TMDB",
  omdb: "OMDb (IMDb ratings)",
};

export function isAiProvider(provider: KeyProvider): provider is AiKeyProvider {
  return provider !== "tmdb" && provider !== "omdb";
}

/** A saved key as the app sees it: never the key itself, only a hint to recognise it. */
export interface KeySummary {
  id: string;
  provider: KeyProvider;
  label: string | null;
  sortOrder: number;
  hint: string | null;
  /** How the key did the last time it was used or tested; null for both until then. */
  lastOk: boolean | null;
  lastMessage: string | null;
  lastCheckedAt: string | null;
}

/** One model name in a provider's list. */
export interface ModelSummary {
  id: string;
  provider: AiKeyProvider;
  model: string;
  sortOrder: number;
}

/** Everything the Keys screen shows. */
export interface KeyConfig {
  keys: KeySummary[];
  models: ModelSummary[];
  /** AI providers in the order they are tried, including ones the user has not ranked yet. */
  providerOrder: AiKeyProvider[];
}

export interface KeyTestResult {
  id: string;
  provider: KeyProvider;
  ok: boolean;
  message: string;
}
