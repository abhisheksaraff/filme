// supabase/functions/_shared/models.ts
// One function per AI provider, all with the same job: send the ticket text, get a JSON object back.
import type { AiProvider } from "./providers.ts";

export interface ModelRequest {
  system: string;
  user: string;
  /** Gemini enforces this; the other providers get the shape described in the prompt instead. */
  geminiSchema: Record<string, unknown>;
  jsonShape: string;
}

/**
 * Why a model call failed. "key" means the key itself is bad (skip it), "model" means the model
 * name is not available (skip it for every key), anything else just moves on to the next try.
 */
export class ModelError extends Error {
  constructor(message: string, public kind: "key" | "model" | "other" = "other") {
    super(message);
  }
}

const TIMEOUT_MS = 60_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ModelError("could not reach the provider");
  }
  if (res.status === 401 || res.status === 403) throw new ModelError("the key was rejected", "key");
  if (res.status === 404) throw new ModelError("model not found", "model");
  if (res.status === 429) throw new ModelError("rate limited");
  if (!res.ok) throw new ModelError(`provider error ${res.status}`);
  return await res.json();
}

/** Pulls the first JSON object out of a model reply, tolerating stray text around it. */
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ModelError("reply had no JSON");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ModelError("reply was not valid JSON");
  }
}

async function gemini(model: string, secret: string, req: ModelRequest): Promise<unknown> {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": secret },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: req.geminiSchema,
        temperature: 0.1,
      },
    },
  );
  // deno-lint-ignore no-explicit-any
  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new ModelError("empty reply");
  return parseJsonObject(text);
}

async function openai(model: string, secret: string, req: ModelRequest): Promise<unknown> {
  const data = await post(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${secret}` },
    {
      model,
      messages: [
        { role: "system", content: `${req.system}\n${req.jsonShape}` },
        { role: "user", content: req.user },
      ],
      response_format: { type: "json_object" },
    },
  );
  // deno-lint-ignore no-explicit-any
  const text = (data as any)?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new ModelError("empty reply");
  return parseJsonObject(text);
}

async function claude(model: string, secret: string, req: ModelRequest): Promise<unknown> {
  const data = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": secret, "anthropic-version": "2023-06-01" },
    {
      model,
      max_tokens: 2000,
      system: `${req.system}\n${req.jsonShape}`,
      messages: [{ role: "user", content: req.user }],
    },
  );
  // deno-lint-ignore no-explicit-any
  const text = (data as any)?.content?.find((part: any) => part?.type === "text")?.text;
  if (typeof text !== "string") throw new ModelError("empty reply");
  return parseJsonObject(text);
}

const CALLERS: Record<AiProvider, (model: string, secret: string, req: ModelRequest) => Promise<unknown>> = {
  gemini,
  openai,
  claude,
};

export function callModel(provider: AiProvider, model: string, secret: string, req: ModelRequest): Promise<unknown> {
  return CALLERS[provider](model, secret, req);
}
