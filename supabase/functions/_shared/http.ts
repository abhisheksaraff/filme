// supabase/functions/_shared/http.ts
// Request plumbing shared by every function: CORS, JSON helpers and error handling.

// SECURITY: browsers may only call these functions from the site itself (and local dev).
const ALLOWED_ORIGINS = [
  "https://abhisheksaraff.github.io",
  "http://localhost:3000",
  "http://10.0.0.169:3000",
];

const MAX_BODY_BYTES = 200_000;

/** An error whose message is safe to show the user. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-action, x-path",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Reads the JSON body as an object, refusing anything oversized or malformed. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Request is too large.");
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to the error below
  }
  throw new HttpError(400, "Request body must be a JSON object.");
}

/** Lets a handler send a file: the response keeps its own body and type and only gains the CORS headers. */
function withCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(corsHeaders(req))) headers.set(key, value);
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}

/** Wraps a handler: answers CORS preflight, allows POST only, and turns errors into safe JSON. */
export function serve(handler: (req: Request) => Promise<unknown>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
    try {
      if (req.method !== "POST") throw new HttpError(405, "Use POST.");
      const out = await handler(req);
      return out instanceof Response ? withCors(req, out) : json(req, out);
    } catch (err) {
      if (err instanceof HttpError) return json(req, { error: err.message }, err.status);
      // Log the kind of failure only; never log request bodies, which can contain keys.
      console.error("Unhandled error:", err instanceof Error ? err.name : "unknown");
      return json(req, { error: "Something went wrong on the server." }, 500);
    }
  });
}
