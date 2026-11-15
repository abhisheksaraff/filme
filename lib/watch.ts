// lib/watch.ts
// Works out where the Watch button should go: builds the candidate links, asks the server which
// ones exist, and opens the result in Brave on iPhone, iPad and Android. Results are kept for a few minutes.
import { callFunction } from "@/lib/adapters/supabase/functions";
import { watchCandidates, type WatchContext } from "@/lib/domain/watchLinks";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

export type WatchTarget =
  | { kind: "ready"; url: string }
  /** The site did not answer. */
  | { kind: "down" }
  /** No link templates have been saved yet. */
  | { kind: "unset" };

const KEEP_MS = 10 * 60_000;
const kept = new Map<string, { at: number; value: Promise<Result<WatchTarget>> }>();

type Status = "exists" | "missing" | "unknown" | "down";

async function resolve(ctx: WatchContext): Promise<Result<WatchTarget>> {
  const links = await services.settings.watchLinks();
  if (!links.ok) return links;
  const candidates = watchCandidates(links.value, ctx);
  if (candidates.length === 0) return ok({ kind: "unset" });

  const checked = await callFunction<{ results: { url: string; status: Status }[] }>("link-check", { urls: candidates.slice(0, 3) });
  if (!checked.ok) return fail(checked.error);
  const byUrl = new Map(checked.value.results.map((r) => [r.url, r.status]));

  // The first link that exists (or that the site would not let us check) wins.
  for (const url of candidates) {
    const status = byUrl.get(url);
    if (status === "exists" || status === "unknown") return ok({ kind: "ready", url });
  }
  if (candidates.some((url) => byUrl.get(url) === "down")) return ok({ kind: "down" });
  // Everything came back missing: the search page is the best that is left.
  return ok({ kind: "ready", url: candidates[candidates.length - 1] });
}

/** Where Watch should go for a title. The same title is only checked once every few minutes. */
export function resolveWatch(ctx: WatchContext): Promise<Result<WatchTarget>> {
  const key = JSON.stringify([ctx.kind, ctx.tmdbId, ctx.title, ctx.season ?? null, ctx.episode ?? null]);
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.value;
  const value = resolve(ctx);
  kept.set(key, { at: Date.now(), value });
  // Anything but a clear answer is not kept, so the next visit asks again.
  value.then((res) => {
    if (!res.ok || res.value.kind !== "ready") if (kept.get(key)?.value === value) kept.delete(key);
  });
  return value;
}

/** Forgets what was checked, for after the link templates change. */
export function forgetWatchChecks(): void {
  kept.clear();
}

const onIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const onAndroid = () => /Android/i.test(navigator.userAgent);

/** Android's own kind of link: names Brave as the app, and the page itself to use if Brave is not installed. */
function braveIntent(url: URL): string {
  const rest = `${url.host}${url.pathname}${url.search}`;
  return `intent://${rest}#Intent;scheme=${url.protocol.replace(":", "")};package=com.brave.browser;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}

/**
 * Opens a link in Brave on iPhone, iPad and Android. A computer's browser cannot hand a page to another
 * browser, so there it opens in a new tab.
 */
export function openWatchLink(url: string): void {
  if (onIos()) window.location.href = `brave://open-url?url=${encodeURIComponent(url)}`;
  else if (onAndroid()) window.location.href = braveIntent(new URL(url));
  else window.open(url, "_blank", "noopener,noreferrer");
}
