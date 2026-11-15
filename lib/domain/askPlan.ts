// lib/domain/askPlan.ts
// What the AI understood from a question about things to watch: people, titles, genres, languages and so on.
// Each part becomes a chip the user can remove; the plan is then run against TMDB without asking the AI again.
import { z } from "zod";

export const askPlanSchema = z.object({
  people: z.array(z.object({ name: z.string().min(1).max(80), role: z.enum(["cast", "director", "writer", "any"]) })).max(5),
  titles: z.array(z.string().min(1).max(80)).max(5),
  genres: z.array(z.string().min(1).max(80)).max(3),
  /** Two-letter language codes such as hi or ta. */
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(6),
  /** Two-letter country codes such as IN. */
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(3),
  keywords: z.array(z.string().min(1).max(80)).max(3),
  like: z.array(z.string().min(1).max(80)).max(2),
  sortBy: z.enum(["popular", "newest", "oldest", "rating"]).nullable(),
  seen: z.enum(["not-seen", "seen", "either"]),
});
export type AskPlan = z.infer<typeof askPlanSchema>;

export const EMPTY_PLAN: AskPlan = { people: [], titles: [], genres: [], languages: [], countries: [], keywords: [], like: [], sortBy: null, seen: "either" };

/** Cleans the AI's reply into a plan; anything unexpected becomes "nothing planned". */
export function normalizePlan(value: unknown): AskPlan {
  const parsed = askPlanSchema.safeParse({ ...EMPTY_PLAN, ...(value && typeof value === "object" ? value : {}) });
  return parsed.success ? parsed.data : EMPTY_PLAN;
}

/** True when the plan asks to find things on TMDB (as opposed to only narrowing the user's own log). */
export function hasPlan(plan: AskPlan): boolean {
  return plan.people.length + plan.titles.length + plan.genres.length + plan.languages.length + plan.countries.length + plan.keywords.length + plan.like.length > 0
    || plan.seen === "not-seen";
}

/** The language codes the app can name; the chip shows the name rather than the code. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam", kn: "Kannada", bn: "Bengali", mr: "Marathi", pa: "Punjabi",
  ko: "Korean", ja: "Japanese", zh: "Chinese", fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", ru: "Russian",
  tr: "Turkish", ar: "Arabic", th: "Thai", sv: "Swedish", da: "Danish", nl: "Dutch", pl: "Polish", fa: "Persian", id: "Indonesian",
};
