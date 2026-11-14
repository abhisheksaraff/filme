// lib/ports/ai.ts
import type { ExtractedData } from "@/lib/domain/extraction";
import type { LogFilter } from "@/lib/domain/askLog";
import type { MovingDates } from "@/lib/domain/holidays";
import type { Result } from "./result";

/** The AI jobs the app uses. */
export interface AiProvider {
  /** Reads ticket text into structured data. */
  extractTicket(text: string): Promise<Result<ExtractedData>>;
  /** The dates of the holidays that move, for one year. Each date is checked before it is returned. */
  holidayDates(year: number, slugs: string[]): Promise<Result<MovingDates>>;
  /** Turns a plain-language question about the log into filters. */
  askLog(question: string): Promise<Result<LogFilter>>;
}
