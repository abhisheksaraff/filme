// lib/domain/watchLinks.ts
// The Watch button's link templates: which placeholders exist and how a template becomes a link.
import { z } from "zod";

const template = z
  .string()
  .trim()
  .max(400)
  // SECURITY: only https links, so the button can never hand the browser a script or app link.
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/.test(value), "Use a link that starts with https://");

export const watchLinksSchema = z.object({
  movie: template.default(""),
  show: template.default(""),
  episode: template.default(""),
  search: template.default(""),
});

export type WatchLinks = z.infer<typeof watchLinksSchema>;
export const EMPTY_WATCH_LINKS: WatchLinks = { movie: "", show: "", episode: "", search: "" };

/** What a template can be filled with. */
export interface WatchContext {
  /** Null for a title that was added by hand and has no TMDB match. */
  tmdbId: number | null;
  kind: "Movie" | "TV Show";
  title: string;
  year: string | null;
  /** Set only for a viewing logged as a single episode. */
  season?: number | null;
  episode?: number | null;
}

export const PLACEHOLDERS: { token: string; note: string }[] = [
  { token: "{tmdb}", note: "id and title, like 1368337-the-odyssey" },
  { token: "{id}", note: "just the number" },
  { token: "{slug}", note: "just the title part" },
  { token: "{title}", note: "the name, ready for a link" },
  { token: "{year}", note: "release year" },
  { token: "{season}", note: "season number" },
  { token: "{episode}", note: "episode number" },
];

/** Lower case, accents removed, apostrophes dropped, everything else that is not a letter or number a hyphen. */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fills in a template; `withSlug` false makes {tmdb} just the number. */
export function fillTemplate(templateText: string, ctx: WatchContext, withSlug = true): string {
  const slug = slugify(ctx.title);
  const id = ctx.tmdbId === null ? "" : String(ctx.tmdbId);
  const values: Record<string, string> = {
    tmdb: withSlug && slug && id ? `${id}-${slug}` : id,
    id,
    slug,
    title: encodeURIComponent(ctx.title).replace(/%20/g, "+"),
    year: ctx.year ?? "",
    season: ctx.season == null ? "" : String(ctx.season),
    episode: ctx.episode == null ? "" : String(ctx.episode),
  };
  return templateText.replace(/\{(tmdb|id|slug|title|year|season|episode)\}/g, (_, key: string) => values[key]);
}

/**
 * The links to try, best first: the exact page, the same page with only the id, then the search page.
 * A title with no TMDB id can only be searched for.
 */
export function watchCandidates(links: WatchLinks, ctx: WatchContext): string[] {
  const isEpisode = ctx.kind === "TV Show" && ctx.season != null && ctx.episode != null;
  const page = ctx.kind === "Movie" ? links.movie : isEpisode && links.episode ? links.episode : links.show;
  const out: string[] = [];
  if (page && ctx.tmdbId !== null) {
    out.push(fillTemplate(page, ctx));
    if (page.includes("{tmdb}")) out.push(fillTemplate(page, ctx, false));
  }
  if (links.search) out.push(fillTemplate(links.search, ctx));
  return [...new Set(out)].filter((url) => url.startsWith("https://"));
}
