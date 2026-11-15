// supabase/functions/omdb/index.ts
// Looks up a title's IMDb rating on OMDb with the user's saved key, so the key never reaches the browser.
import { enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { loadSlots } from "../_shared/providers.ts";

// OMDb's free plan allows 1,000 a day; stay under it.
const DAILY_LIMIT = 900;
const TIMEOUT_MS = 10_000;

serve(async (req) => {
  const { userId } = await requireUser(req);
  const body = await readJson(req);

  // SECURITY: only a plain IMDb id is passed on, so the request cannot be bent into another OMDb query.
  const imdbId = body.imdbId;
  if (typeof imdbId !== "string" || !/^tt\d{5,10}$/.test(imdbId)) throw new HttpError(400, "That is not an IMDb id.");

  await enforceLimit(userId, "omdb", DAILY_LIMIT);

  const slots = await loadSlots(userId, ["omdb"]);
  if (slots.length === 0) throw new HttpError(400, "No OMDb key is saved yet. Add one under Profile → API keys.");

  let lastError = "Could not reach OMDb.";
  for (const slot of slots) {
    let res: Response;
    try {
      const url = new URL("https://www.omdbapi.com/");
      url.searchParams.set("apikey", slot.secret);
      url.searchParams.set("i", imdbId);
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      continue;
    }
    if (res.status === 401) {
      await res.body?.cancel();
      lastError = "OMDb rejected the saved key.";
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      continue;
    }
    const data = (await res.json().catch(() => null)) as { Response?: string; Error?: string; imdbRating?: string } | null;
    if (!data) continue;
    if (data.Response === "False") {
      if (/limit/i.test(data.Error ?? "")) throw new HttpError(429, "OMDb's daily limit is used up.");
      if (/api key/i.test(data.Error ?? "")) {
        lastError = "OMDb rejected the saved key.";
        continue;
      }
      // The title is simply not there: no rating.
      return { rating: null };
    }
    const rating = Number(data.imdbRating);
    return { rating: Number.isFinite(rating) && rating > 0 ? rating : null };
  }
  throw new HttpError(502, lastError);
});
