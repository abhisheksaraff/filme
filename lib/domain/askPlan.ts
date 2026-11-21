// lib/domain/askPlan.ts
// What the AI understood from a question about things to watch: people, titles, genres, languages and so on.
// Each part becomes a chip the user can remove; the plan is then run against TMDB without asking the AI again.
import { z } from "zod";
import { languageName } from "./tagLists";

export const askPlanSchema = z.object({
  // A person picked by hand carries their TMDB id and photo, so the right one is searched for; the AI gives only a name.
  people: z.array(z.object({ name: z.string().min(1).max(80), role: z.enum(["cast", "director", "writer", "any"]), tmdbId: z.number().int().positive().optional(), profilePath: z.string().max(120).nullable().optional() })).max(8),
  titles: z.array(z.string().min(1).max(80)).max(5),
  genres: z.array(z.string().min(1).max(80)).max(6),
  /** Two-letter language codes such as hi or ta. */
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(8),
  /** Two-letter country codes such as IN. */
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(6),
  keywords: z.array(z.string().min(1).max(80)).max(6),
  like: z.array(z.string().min(1).max(80)).max(2),
  sortBy: z.enum(["popular", "newest", "oldest", "rating"]).nullable(),
  seen: z.enum(["not-seen", "seen", "either"]),
  /** Minutes; movies only, since TMDB has no runtime filter for shows. */
  maxRuntime: z.number().int().min(1).max(600).nullable(),
  minRuntime: z.number().int().min(1).max(600).nullable(),
  /** Streaming services by name, such as Netflix. */
  providers: z.array(z.string().min(1).max(80)).max(3),
  inTheatres: z.enum(["now", "soon", "both"]).nullable(),
});
export type AskPlan = z.infer<typeof askPlanSchema>;

export const EMPTY_PLAN: AskPlan = { people: [], titles: [], genres: [], languages: [], countries: [], keywords: [], like: [], sortBy: null, seen: "either", maxRuntime: null, minRuntime: null, providers: [], inTheatres: null };

/** Cleans the AI's reply into a plan; anything unexpected becomes "nothing planned". */
export function normalizePlan(value: unknown): AskPlan {
  const parsed = askPlanSchema.safeParse({ ...EMPTY_PLAN, ...(value && typeof value === "object" ? value : {}) });
  return parsed.success ? parsed.data : EMPTY_PLAN;
}

/** True when the plan asks to find things on TMDB (as opposed to only narrowing the user's own log). */
export function hasPlan(plan: AskPlan): boolean {
  return plan.people.length + plan.titles.length + plan.genres.length + plan.languages.length + plan.countries.length + plan.keywords.length + plan.like.length + plan.providers.length > 0
    || plan.seen === "not-seen" || plan.maxRuntime !== null || plan.minRuntime !== null || plan.inTheatres !== null;
}

/** Language names by code, for the chips; any code the browser knows is named. */
export const LANGUAGE_NAMES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_target, code) => (typeof code === "string" && /^[a-z]{2}$/.test(code) ? languageName(code) : undefined),
});
