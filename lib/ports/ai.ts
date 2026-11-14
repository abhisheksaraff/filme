// lib/ports/ai.ts
import type { ExtractedData } from "@/lib/domain/extraction";
import type { Result } from "./result";

/** Reads ticket text into structured data. */
export interface AiProvider {
  extractTicket(text: string): Promise<Result<ExtractedData>>;
}
