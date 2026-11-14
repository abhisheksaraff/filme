// lib/aiClient.ts

import { CredentialsModel } from './credentialsModel';
import { 
  ExtractedData, 
  DEFAULT_EXTRACTED_DATA, 
  EXTRACTION_RESPONSE_SCHEMA 
} from '../types/watchSession';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

export interface AIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

const SYSTEM_INSTRUCTION = `
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

/**
 * Helper to delay execution for exponential backoff retries
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to sanitize string values and map "Unknown", "N/A", or whitespace to null
 */
function normalizeNullField(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  const lower = value.trim().toLowerCase();
  if (
    lower === 'unknown' || 
    lower === 'n/a' || 
    lower === 'none' || 
    lower === 'null' ||
    lower === 'tbd' ||
    lower === 'not found'
  ) {
    return null;
  }
  return value.trim();
}

/**
 * Sanitizes category input and guarantees TypeScript alignment with ExtractedData['category']
 */
function sanitizeCategory(value?: string | null): ExtractedData['category'] {
  const normalized = normalizeNullField(value);
  if (!normalized) return null;

  const validCategories = ['Movie', 'TV Show', 'Concert', 'Live Event', 'Unknown'] as const;
  const matched = validCategories.find(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  );

  return matched ?? null;
}

export const AIClient = {
  /**
   * Validates a Gemini API Key against the Google AI models endpoint
   */
  async validateApiKey(testKey?: string): Promise<boolean> {
    const key = testKey || (await CredentialsModel.getKey('ai'));
    if (!key) return false;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch (error) {
      console.warn('[AIClient] Key validation failed:', error);
      return false;
    }
  },

  /**
   * Parses raw unstructured ticket text into structured ExtractedData
   */
  async parseExtractedText(rawText: string): Promise<AIResponse<ExtractedData>> {
    const apiKey = await CredentialsModel.getKey('ai');
    
    if (!apiKey) {
      return {
        success: false,
        data: { ...DEFAULT_EXTRACTED_DATA },
        error: 'AI API Key is missing. Please configure your settings.',
      };
    }

    if (!rawText?.trim()) {
      return {
        success: false,
        data: { ...DEFAULT_EXTRACTED_DATA },
        error: 'No readable text was provided for extraction.',
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const currentDateIso = new Date().toISOString();
    const userPrompt = `Current Context ISO Date: ${currentDateIso}\nExtract watch session data from:\n\n${rawText}`;

    let attempt = 0;
    let currentDelay = INITIAL_RETRY_DELAY_MS;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: EXTRACTION_RESPONSE_SCHEMA,
              temperature: 0.1,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let parsedError;
          try {
            parsedError = JSON.parse(errorText);
          } catch {
            parsedError = null;
          }

          const status = response.status;
          const isTransient = status === 503 || status === 429 || status >= 500;

          if (isTransient && attempt < MAX_RETRIES) {
            attempt++;
            await delay(currentDelay);
            currentDelay *= 2;
            continue;
          }

          let errorMessage = 'Failed to extract ticket data.';
          if (status === 503) {
            errorMessage = 'Gemini servers are currently experiencing high demand. Please try again in a moment.';
          } else if (status === 429) {
            errorMessage = 'Rate limit exceeded. Please wait a few seconds before trying again.';
          } else if (parsedError?.error?.message) {
            errorMessage = parsedError.error.message;
          }

          return {
            success: false,
            data: { ...DEFAULT_EXTRACTED_DATA },
            error: errorMessage,
          };
        }

        const data = await response.json();
        const rawJsonResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawJsonResponse) {
          return {
            success: false,
            data: { ...DEFAULT_EXTRACTED_DATA },
            error: 'AI did not return any parseable content.',
          };
        }

        const parsed: Partial<ExtractedData> = JSON.parse(rawJsonResponse);

        const extractedData: ExtractedData = {
          category: sanitizeCategory(parsed.category),
          title: normalizeNullField(parsed.title),
          season: parsed.season ?? null,
          episode: parsed.episode ?? null,
          episodeTitle: normalizeNullField(parsed.episodeTitle),
          location: normalizeNullField(parsed.location),
          address: normalizeNullField(parsed.address),
          auditorium: normalizeNullField(parsed.auditorium),
          date: normalizeNullField(parsed.date),
          time: normalizeNullField(parsed.time),
          seats: Array.isArray(parsed.seats) ? parsed.seats : [],
          totalTickets: parsed.totalTickets ?? (parsed.seats?.length || 1),
          primaryFormat: parsed.primaryFormat || 'Standard',
          addons: Array.isArray(parsed.addons) ? parsed.addons : [],
        };

        return {
          success: true,
          data: extractedData,
        };
      } catch {
        if (attempt < MAX_RETRIES) {
          attempt++;
          await delay(currentDelay);
          currentDelay *= 2;
          continue;
        }

        return {
          success: false,
          data: { ...DEFAULT_EXTRACTED_DATA },
          error: 'An unexpected network error occurred while reaching Gemini API.',
        };
      }
    }

    return {
      success: false,
      data: { ...DEFAULT_EXTRACTED_DATA },
      error: 'Service remains unavailable after multiple retry attempts.',
    };
  },

  /**
   * Accepts pre-extracted OCR text arrays, formats page breaks, and sends to AI
   */
  async parseTicketImages(extractedTexts: string[]): Promise<AIResponse<ExtractedData>> {
    if (!extractedTexts || extractedTexts.length === 0) {
      return {
        success: false,
        data: { ...DEFAULT_EXTRACTED_DATA },
        error: 'No extracted text was provided for processing.',
      };
    }

    const combinedText = extractedTexts.filter(Boolean).join('\n--- PAGE BREAK ---\n');

    if (!combinedText.trim()) {
      return {
        success: false,
        data: { ...DEFAULT_EXTRACTED_DATA },
        error: 'Could not detect any readable text from the ticket image(s).',
      };
    }

    return await this.parseExtractedText(combinedText);
  },
};