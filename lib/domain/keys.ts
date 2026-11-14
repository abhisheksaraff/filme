// lib/domain/keys.ts
// Vocabulary for the API keys screen.

export const KEY_PROVIDERS = ["gemini", "openai", "claude", "tmdb"] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<KeyProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Anthropic Claude",
  tmdb: "TMDB",
};

export function isAiProvider(provider: KeyProvider): boolean {
  return provider !== "tmdb";
}

/** A saved key as the app sees it: never the key itself, only a hint to recognise it. */
export interface KeySummary {
  id: string;
  provider: KeyProvider;
  label: string | null;
  models: string[];
  sortOrder: number;
  hint: string | null;
}

export interface NewKey {
  provider: KeyProvider;
  label?: string;
  models: string[];
  secret: string;
}

export interface KeyTestResult {
  id: string;
  provider: KeyProvider;
  ok: boolean;
  message: string;
}
