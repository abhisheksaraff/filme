// lib/ports/keys.ts
import type { AiKeyProvider, KeyConfig, KeyProvider, KeyTestResult } from "@/lib/domain/keys";
import type { Result } from "./result";

/** Stores and manages API keys, model lists and provider order. A saved key can never be read back. */
export interface KeyVault {
  load(): Promise<Result<KeyConfig>>;

  /**
   * Checks every key with its provider, then saves them in the order given. If any key fails,
   * none are saved and the error says which one.
   */
  addKeys(provider: KeyProvider, secrets: string[]): Promise<Result<void>>;
  removeKey(id: string): Promise<Result<void>>;
  /** Saves the order of one provider's keys: the first id is tried first. */
  reorderKeys(ids: string[]): Promise<Result<void>>;
  /** Checks one key, or every key when no id is given, against its provider. */
  testKeys(id?: string): Promise<Result<KeyTestResult[]>>;

  /** Makes the provider's saved model list exactly this list, in this order. */
  setModels(provider: AiKeyProvider, models: string[]): Promise<Result<void>>;

  reorderProviders(providers: AiKeyProvider[]): Promise<Result<void>>;
}
