// lib/ports/keys.ts
import type { AiKeyProvider, KeyConfig, KeyTestResult, NewKey } from "@/lib/domain/keys";
import type { Result } from "./result";

/** Stores and manages API keys, model lists and provider order. A saved key can never be read back. */
export interface KeyVault {
  load(): Promise<Result<KeyConfig>>;

  addKey(key: NewKey): Promise<Result<void>>;
  removeKey(id: string): Promise<Result<void>>;
  /** Saves the order of one provider's keys: the first id is tried first. */
  reorderKeys(ids: string[]): Promise<Result<void>>;
  /** Checks one key, or every key when no id is given, against its provider. */
  testKeys(id?: string): Promise<Result<KeyTestResult[]>>;

  addModel(provider: AiKeyProvider, model: string): Promise<Result<void>>;
  removeModel(id: string): Promise<Result<void>>;
  reorderModels(provider: AiKeyProvider, ids: string[]): Promise<Result<void>>;

  reorderProviders(providers: AiKeyProvider[]): Promise<Result<void>>;
}
