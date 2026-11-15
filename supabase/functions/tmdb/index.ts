// supabase/functions/tmdb/index.ts
// Forwards read-only requests to TMDB using the user's saved key, so the key never reaches the browser.
import { enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { loadSlots } from "../_shared/providers.ts";

const DAILY_LIMIT = 2000;
const TIMEOUT_MS = 15_000;

// SECURITY: only these TMDB paths can be requested, so the function cannot be used as a general proxy.
const ALLOWED_PATHS: RegExp[] = [
  /^\/configuration$/,
  /^\/search\/(multi|movie|tv|person|keyword)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/(recommendations|similar|credits|keywords)$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/tv\/\d+\/season\/\d+\/episode\/\d+$/,
  /^\/person\/\d+$/,
  /^\/person\/\d+\/combined_credits$/,
  /^\/(movie|tv)\/\d+\/images$/,
  /^\/discover\/(movie|tv)$/,
  /^\/movie\/(now_playing|upcoming|popular|top_rated)$/,
  /^\/tv\/(on_the_air|airing_today|popular|top_rated)$/,
  /^\/trending\/(movie|tv|all)\/(day|week)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/collection\/\d+$/,
];

function cleanParams(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "params must be an object.");
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[a-z_.]{1,40}$/.test(key) || key === "api_key") throw new HttpError(400, "A request parameter is not allowed.");
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      throw new HttpError(400, "Request parameters must be simple values.");
    }
    const text = String(raw);
    if (text.length > 200) throw new HttpError(400, "A request parameter is too long.");
    out[key] = text;
  }
  return out;
}

serve(async (req) => {
  const { userId } = await requireUser(req);
  const body = await readJson(req);

  const path = body.path;
  if (typeof path !== "string" || !ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    throw new HttpError(400, "That TMDB request is not allowed.");
  }
  const params = cleanParams(body.params);

  await enforceLimit(userId, "tmdb", DAILY_LIMIT);

  const slots = await loadSlots(userId, ["tmdb"]);
  if (slots.length === 0) throw new HttpError(400, "No TMDB key is saved yet. Add one under Profile → Keys.");

  // Try each saved key in order; move on when one is rejected, rate limited or the service errors.
  let lastStatus = 0;
  for (const slot of slots) {
    const bearer = slot.secret.startsWith("eyJ");
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (!bearer) url.searchParams.set("api_key", slot.secret);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: bearer ? { Authorization: `Bearer ${slot.secret}` } : {},
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      lastStatus = 0;
      continue;
    }

    if (res.ok) return await res.json();
    if (res.status === 404) throw new HttpError(404, "Not found on TMDB.");
    lastStatus = res.status;
    await res.body?.cancel();
  }
  throw new HttpError(502, lastStatus === 0 ? "Could not reach TMDB." : `TMDB refused the request (status ${lastStatus}).`);
});
