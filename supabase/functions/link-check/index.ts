// supabase/functions/link-check/index.ts
// Tells the app whether a page on another website exists, because the browser itself is not allowed
// to look. It only reports a status; it never returns the page.
import { enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";

const DAILY_LIMIT = 600;
const TIMEOUT_MS = 8000;
const MAX_URLS = 3;
const MAX_REDIRECTS = 3;

type Status = "exists" | "missing" | "unknown" | "down";

/** True for addresses that point inside a network instead of at the public internet. */
function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** SECURITY: only public https hosts; a name that resolves to an internal address is refused. */
async function checkTarget(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase();
  const literal = /^[0-9.]+$/.test(host) || host.includes(":") || host.startsWith("[");
  if (url.protocol !== "https:" || literal || !host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || url.username || url.password) {
    throw new HttpError(400, "That link is not allowed.");
  }
  try {
    const found = [...(await Deno.resolveDns(host, "A").catch(() => [])), ...(await Deno.resolveDns(host, "AAAA").catch(() => []))];
    if (found.some(isPrivateAddress)) throw new HttpError(400, "That link is not allowed.");
  } catch (err) {
    if (err instanceof HttpError) throw err;
  }
}

async function statusOf(link: string): Promise<Status> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, "That link is not allowed.");
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await checkTarget(url);
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; filme-link-check)", Accept: "text/html" },
      });
      // Only the status matters; the body is dropped without reading it.
      await res.body?.cancel();
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location") as string, url);
        continue;
      }
      if (res.status >= 200 && res.status < 300) return "exists";
      if (res.status === 404 || res.status === 410) return "missing";
      // The site answered but would not show us the page (blocked, rate limited): the page may well be fine.
      if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 405) return "unknown";
      return "down";
    }
    return "unknown";
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return "down";
  }
}

serve(async (req) => {
  const { userId } = await requireUser(req);
  const body = await readJson(req);
  const urls = body.urls;
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS || urls.some((u) => typeof u !== "string" || u.length > 600)) {
    throw new HttpError(400, "urls must be a short list of links.");
  }
  await enforceLimit(userId, "link-check", DAILY_LIMIT);
  const results = await Promise.all((urls as string[]).map(async (url) => ({ url, status: await statusOf(url) })));
  return { results };
});
