// supabase/functions/ai/index.ts
// Reads OCR'd ticket text with the user's saved AI keys, trying each key and model in their order.
import { enforceLimit, requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";
import { callModel, ModelError, type ModelRequest } from "../_shared/models.ts";
import { AI_PROVIDERS, loadSlots, type AiProvider } from "../_shared/providers.ts";
import { jsonShapeInstruction, SYSTEM_INSTRUCTION } from "../_shared/prompts.ts";

const DAILY_LIMIT = 150;
const MAX_TEXT_CHARS = 40_000;
const MAX_LIST_ITEMS = 400;

function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) throw new HttpError(400, `${name} must be a list.`);
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
        enum: ["Movie", "TV Show", "Concert", "Live Event"],
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

serve(async (req) => {
  const { userId } = await requireUser(req);
  const body = await readJson(req);

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new HttpError(400, "No ticket text was provided.");
  if (text.length > MAX_TEXT_CHARS) throw new HttpError(413, "The ticket text is too long.");
  const primaryFormats = stringList(body.primaryFormats, "primaryFormats");
  const addons = stringList(body.addons, "addons");
  const today = typeof body.today === "string" ? body.today.slice(0, 40) : new Date().toISOString();

  await enforceLimit(userId, "ai", DAILY_LIMIT);

  const slots = await loadSlots(userId, AI_PROVIDERS);
  if (slots.length === 0) throw new HttpError(400, "No AI key is saved yet. Add one under Profile → Keys.");

  const request: ModelRequest = {
    system: SYSTEM_INSTRUCTION,
    user: `Current Context ISO Date: ${today}\nExtract watch session data from:\n\n${text}`,
    geminiSchema: geminiSchema(primaryFormats, addons),
    jsonShape: jsonShapeInstruction(primaryFormats, addons),
  };

  // Try each key in order, and within a key each model in order. The first success ends it,
  // so a normal scan costs exactly one AI request.
  const notes: string[] = [];
  for (const slot of slots) {
    for (const model of slot.models) {
      try {
        const data = await callModel(slot.provider as AiProvider, model, slot.secret, request);
        return { data, provider: slot.provider, model };
      } catch (err) {
        const reason = err instanceof ModelError ? err.message : "unexpected error";
        notes.push(`${slot.provider}/${model}: ${reason}`);
      }
    }
  }
  throw new HttpError(502, `Every AI key failed. ${notes.join("; ")}`);
});
