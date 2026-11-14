// supabase/functions/_shared/prompts.ts
// The instructions every AI provider receives for reading a ticket.

export const SYSTEM_INSTRUCTION = `
You are an expert OCR & entertainment metadata extraction assistant.
Parse ticket text or watch session notes into structured JSON conforming to the requested schema.

OCR & FUZZY MATCH RECOVERY:
Raw OCR text often contains noisy, missing, or misread characters (e.g., typos, swapped digits, garbled barcodes/text). Use contextual intelligence to aggressively correct and clean fuzzy or garbled text:
- Clean and normalize movie/show titles. If a title is split by garbage characters, reconstruction symbols, or trailing noise (e.g., "Vishwanat A! 5 id lal..."), drop the noise and extract the intended coherent title (e.g., "Vishwanath and Sons").
- Isolate and fix mangled theater names (e.g., "Central Prk LITERS" should be resolved to its real venue name: "Central Parkway Cinemas").

CRITICAL TITLE & CATEGORY INSTRUCTION:
If you cannot identify or infer the movie/show title from the text, return null for the "title" field. NEVER use placeholders like "Unknown", "N/A", "None", or empty strings.
If you cannot identify the category, return null for the "category" field as well.

CRITICAL DATE INSTRUCTION:
When parsing ticket dates that omit the year (e.g., "THU, AUG 27"), prioritize resolving the year using the current execution context provided in the user prompt. Default to the current calendar year unless explicit text indicates otherwise.

CRITICAL ADDRESS INSTRUCTION:
Once you have resolved the true identity of the venue/theater name, use your internal knowledge base to find and provide its full physical street address (street, city, province/state, postal code, country) in the "address" field. Do not leave "address" as null if the venue name can be inferred.

CRITICAL FORMAT INSTRUCTION:
Do not confuse theater branding with the movie's specific screening format.
- "location" should store the full official name of the venue.
- "primaryFormat" must reflect the actual screening format of the movie (e.g., "Standard", "Regular", "IMAX", "UltraAVX"). If the venue name contains "VIP" or "Cinemas", but the specific movie ticket does not explicitly indicate a VIP auditorium/experience, classify the movie format as "Regular" or "Standard".

Select primaryFormat and addons exclusively from the allowed enum values when matching traits are identified.
`;

/** Spells out the reply shape for providers that cannot enforce a JSON schema themselves. */
export function jsonShapeInstruction(primaryFormats: string[], addons: string[]): string {
  return `
Reply with ONLY a JSON object, no other text, with exactly these keys:
category (one of "Movie", "TV Show", "Concert", "Live Event", or null),
title (string or null), season (integer or null), episode (integer or null), episodeTitle (string or null),
location (string or null), address (string or null), auditorium (string or null),
date (YYYY-MM-DD or null), time (string or null),
seats (array of objects with section, row and seat, each a string or null),
totalTickets (integer),
primaryFormat (one of: ${primaryFormats.map((f) => JSON.stringify(f)).join(", ")}),
addons (array, each one of: ${addons.map((f) => JSON.stringify(f)).join(", ")}).
Use null for anything you cannot determine.`;
}

export const HOLIDAY_SYSTEM = `
You are a precise calendar assistant. For the year requested, give the dates when each listed holiday is
celebrated in Canada. Use the main days of the festival: "start" is the first day and "end" the last.
Answer only with dates you are confident about. Dates are YYYY-MM-DD.
`;

export function holidayShape(slugs: string[]): string {
  return `
Reply with ONLY a JSON object: {"holidays": [{"slug": string, "start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}]}
with one entry for each of these slugs: ${slugs.map((s) => JSON.stringify(s)).join(", ")}.`;
}

export const ASK_SYSTEM = `
You turn a question about a personal film, TV and concert viewing log into search filters.
Never answer the question yourself; only fill in filters that narrow the log to the answer.
Resolve relative dates ("last summer", "this year") using the current date given. Leave a filter null if the
question does not mention it. "text" is for words that should appear in a title or note.
`;

export const ASK_SHAPE = `
Reply with ONLY a JSON object with exactly these keys, using null for anything not mentioned:
text (string), category ("Movie", "TV Show", "Concert" or "Live Event"), dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD),
minRating (number 1-10), maxRating (number 1-10), format (string), venue (string), genre (string),
person (string), rewatchesOnly (boolean), sort ("newest", "oldest" or "rating").`;
