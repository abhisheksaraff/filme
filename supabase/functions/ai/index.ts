// supabase/functions/ai/index.ts
// Runs the user's saved AI keys for three jobs: reading a ticket, looking up moving holiday dates,
// and turning a plain-language question into log filters. Keys and models are tried in their order.
import { enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { callModel, ModelError, type ModelRequest } from "../_shared/models.ts";
import { loadAiPlan } from "../_shared/providers.ts";
import {
  ASK_SHAPE,
  ASK_SYSTEM,
  HOLIDAY_SYSTEM,
  holidayShape,
  jsonShapeInstruction,
  SYSTEM_INSTRUCTION,
} from "../_shared/prompts.ts";

const DAILY_LIMIT = 150;
const MAX_TEXT_CHARS = 40_000;
const MAX_LIST_ITEMS = 400;
const CATEGORIES = ["Movie", "TV Show", "Concert", "Live Event"];

function stringList(value: unknown, name: string, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new HttpError(400, `${name} must be a list.`);
  return value.map((item) => {
    if (typeof item !== "string" || item.length > 80) throw new HttpError(400, `${name} contains an invalid entry.`);
    return item;
  });
}

/** Gemini's structured-output schema, built from the format lists the app sends. */
function geminiSchema(primaryFormats: string[], addons: string[]): Record<string, unknown> {
  const nullableString = (description: string) => ({ type: "STRING", description, nullable: true });
  return {
    type: "OBJECT",
    properties: {
      category: {
        type: "STRING",
        enum: CATEGORIES,
        description: "Inferred type of ticket/event. Null if unidentified.",
        nullable: true,
      },
      title: nullableString("Movie, show or event/artist name. MUST be null if it cannot be identified."),
      season: { type: "INTEGER", description: "Season number or null", nullable: true },
      episode: { type: "INTEGER", description: "Episode number or null", nullable: true },
      episodeTitle: nullableString("Optional episode title"),
      location: nullableString("Theater, venue, stadium or platform name"),
      address: nullableString("Full physical street address of the venue"),
      auditorium: nullableString('Screen, room, hall or stage (e.g. "Auditorium 4")'),
      date: nullableString("YYYY-MM-DD or null"),
      time: nullableString('HH:mm or "7:30 PM" or null'),
      seats: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            section: nullableString("Section for this seat"),
            row: nullableString("Row for this seat"),
            seat: nullableString("Seat number or code"),
          },
        },
        description: "Seating details for each ticket",
      },
      totalTickets: { type: "INTEGER", description: "Total ticket count or 1", nullable: true },
      primaryFormat: { type: "STRING", enum: primaryFormats, description: "Core format brand or venue type", nullable: true },
      addons: { type: "ARRAY", items: { type: "STRING", enum: addons }, description: "Tech or event modifiers" },
    },
  };
}

const HOLIDAY_SCHEMA = {
  type: "OBJECT",
  properties: {
    holidays: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          slug: { type: "STRING" },
          start: { type: "STRING", description: "YYYY-MM-DD" },
          end: { type: "STRING", description: "YYYY-MM-DD" },
        },
        required: ["slug", "start", "end"],
      },
    },
  },
  required: ["holidays"],
};

const ASK_SCHEMA = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING", nullable: true },
    category: { type: "STRING", enum: CATEGORIES, nullable: true },
    dateFrom: { type: "STRING", nullable: true },
    dateTo: { type: "STRING", nullable: true },
    releaseFrom: { type: "INTEGER", nullable: true },
    releaseTo: { type: "INTEGER", nullable: true },
    minRating: { type: "NUMBER", nullable: true },
    maxRating: { type: "NUMBER", nullable: true },
    format: { type: "STRING", nullable: true },
    venue: { type: "STRING", nullable: true },
    genre: { type: "STRING", nullable: true },
    person: { type: "STRING", nullable: true },
    rewatchesOnly: { type: "BOOLEAN", nullable: true },
    sort: { type: "STRING", enum: ["newest", "oldest", "rating"], nullable: true },
  },
};

const isoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** SECURITY: a model reply is untrusted, so each holiday is checked before it is passed on. */
function validateHolidays(data: unknown, year: number, slugs: string[]): unknown {
  const list = (data as { holidays?: unknown })?.holidays;
  if (!Array.isArray(list)) throw new ModelError("reply had no holidays");
  const out: { slug: string; start: string; end: string }[] = [];
  for (const item of list) {
    const { slug, start, end } = (item ?? {}) as Record<string, unknown>;
    if (typeof slug !== "string" || !slugs.includes(slug) || !isoDate(start) || !isoDate(end)) continue;
    const from = Date.parse(start);
    const to = Date.parse(end);
    const startYear = Number(start.slice(0, 4));
    // The festival must begin in the requested year (or just before it) and last at most two weeks.
    if (startYear < year - 1 || startYear > year + 1 || to < from || to - from > 14 * 86_400_000) continue;
    if (!out.some((existing) => existing.slug === slug)) out.push({ slug, start, end });
  }
  if (out.length === 0) throw new ModelError("no usable holiday dates");
  return { holidays: out };
}

function validateAsk(data: unknown): unknown {
  if (!data || typeof data !== "object") throw new ModelError("reply was not an object");
  const raw = data as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  const year = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1870 && v <= 2200 ? v : null);
  const rating = (v: unknown) => (typeof v === "number" && v >= 1 && v <= 10 ? v : null);
  return {
    text: text(raw.text),
    category: CATEGORIES.includes(raw.category as string) ? raw.category : null,
    dateFrom: isoDate(raw.dateFrom) ? raw.dateFrom : null,
    dateTo: isoDate(raw.dateTo) ? raw.dateTo : null,
    releaseFrom: year(raw.releaseFrom),
    releaseTo: year(raw.releaseTo),
    minRating: rating(raw.minRating),
    maxRating: rating(raw.maxRating),
    format: text(raw.format),
    venue: text(raw.venue),
    genre: text(raw.genre),
    person: text(raw.person),
    rewatchesOnly: raw.rewatchesOnly === true,
    sort: ["newest", "oldest", "rating"].includes(raw.sort as string) ? raw.sort : null,
  };
}

serve(async (req) => {
  const { userId } = await requireUser(req);
  const body = await readJson(req);
  const task = body.task === "holidays" ? "holidays" : body.task === "ask" ? "ask" : "extract";
  const today = typeof body.today === "string" ? body.today.slice(0, 40) : new Date().toISOString();

  let request: ModelRequest;
  let validate: (data: unknown) => unknown = (data) => data;

  if (task === "holidays") {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, "That year is not valid.");
    const slugs = stringList(body.slugs, "slugs", 20);
    request = {
      system: HOLIDAY_SYSTEM,
      user: `Year: ${year}\nHolidays: ${slugs.join(", ")}`,
      geminiSchema: HOLIDAY_SCHEMA,
      jsonShape: holidayShape(slugs),
    };
    validate = (data) => validateHolidays(data, year, slugs);
  } else if (task === "ask") {
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 300) throw new HttpError(400, "Ask a question of up to 300 characters.");
    request = {
      system: ASK_SYSTEM,
      user: `Current date: ${today}\nQuestion: ${question}`,
      geminiSchema: ASK_SCHEMA,
      jsonShape: ASK_SHAPE,
    };
    validate = validateAsk;
  } else {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new HttpError(400, "No ticket text was provided.");
    if (text.length > MAX_TEXT_CHARS) throw new HttpError(413, "The ticket text is too long.");
    const primaryFormats = stringList(body.primaryFormats, "primaryFormats");
    const addons = stringList(body.addons, "addons");
    request = {
      system: SYSTEM_INSTRUCTION,
      user: `Current Context ISO Date: ${today}\nExtract watch session data from:\n\n${text}`,
      geminiSchema: geminiSchema(primaryFormats, addons),
      jsonShape: jsonShapeInstruction(primaryFormats, addons),
    };
  }

  await enforceLimit(userId, "ai", DAILY_LIMIT);

  const plan = await loadAiPlan(userId);
  if (plan.length === 0) throw new HttpError(400, "No AI key is saved yet. Add one under Profile → Keys.");

  // Providers in the user's order; within one, each model in order, and for each model each key.
  // A rejected key is skipped for later models, and a missing model is skipped for later keys, so a
  // normal request costs one AI call and a failure never repeats a call that cannot succeed.
  const notes: string[] = [];
  for (const { provider, models, keys } of plan) {
    if (models.length === 0) {
      notes.push(`${provider}: no models listed`);
      continue;
    }
    const badKeys = new Set<string>();
    for (const model of models) {
      for (const key of keys) {
        if (badKeys.has(key.id)) continue;
        try {
          const data = validate(await callModel(provider, model, key.secret, request));
          return { data, provider, model };
        } catch (err) {
          const failure = err instanceof ModelError ? err : new ModelError("unexpected error");
          notes.push(`${provider}/${model}: ${failure.message}`);
          if (failure.kind === "key") badKeys.add(key.id);
          if (failure.kind === "model") break;
        }
      }
    }
  }
  throw new HttpError(502, `Every AI attempt failed. ${notes.join("; ")}`);
});
