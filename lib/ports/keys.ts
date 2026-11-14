// lib/ports/keys.ts
import type { KeySummary, KeyTestResult, NewKey } from "@/lib/domain/keys";
import type { Result } from "./result";

/** Stores and manages API keys. A saved key can never be read back, only used or tested. */
export interface KeyVault {
  list(): Promise<Result<KeySummary[]>>;
  add(key: NewKey): Promise<Result<void>>;
  remove(id: string): Promise<Result<void>>;
  /** Saves a new fallback order: the first id is tried first. */
  reorder(ids: string[]): Promise<Result<void>>;
  /** Checks one key, or every key when no id is given, against its provider. */
  test(id?: string): Promise<Result<KeyTestResult[]>>;
}
