// lib/adapters/ai/EdgeAIProvider.ts
// Sends ticket text to the `ai` Edge Function, which holds the keys and picks the model.
import { DEFAULT_EXTRACTED_DATA, normalizeExtraction, type ExtractedData } from "@/lib/domain/extraction";
import { FORMAT_ADDONS, PRIMARY_FORMATS } from "@/lib/domain/formats";
import type { AiProvider } from "@/lib/ports/ai";
import { fail, ok, type Result } from "@/lib/ports/result";
import { callFunction } from "../supabase/functions";

// Remembers answers by text so re-opening or re-rendering a scan never spends another AI request.
const cache = new Map<string, Promise<Result<ExtractedData>>>();

async function request(text: string): Promise<Result<ExtractedData>> {
  const res = await callFunction<{ data: unknown }>("ai", {
    text,
    primaryFormats: PRIMARY_FORMATS,
    addons: FORMAT_ADDONS,
    today: new Date().toISOString(),
  });
  if (!res.ok) return fail(res.error);
  // SECURITY: the reply is model output, so it is validated and cleaned before the app trusts it.
  return ok(normalizeExtraction(res.value.data ?? DEFAULT_EXTRACTED_DATA));
}

export const edgeAiProvider: AiProvider = {
  extractTicket(text) {
    const cached = cache.get(text);
    if (cached) return cached;
    const pending = request(text).then((result) => {
      if (!result.ok) cache.delete(text); // let a failed attempt be retried
      return result;
    });
    cache.set(text, pending);
    return pending;
  },
};
