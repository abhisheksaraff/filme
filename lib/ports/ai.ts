// lib/ports/ai.ts
import type { ExtractedData } from "@/lib/domain/extraction";
import type { AskPlan } from "@/lib/domain/askPlan";
import type { LogFilter } from "@/lib/domain/askLog";
import type { MovingDates } from "@/lib/domain/holidays";
import type { Result } from "./result";

/** What the AI chooses for one story: captions, picture searches and one music search. */
export interface StoryTheme {
  lines: string[];
  pictures: string[];
  music: string;
}

/** What the AI is told about a story. */
export interface StoryThemeInput {
  label: string;
  titles: string[];
  places: string[];
  festival: string | null;
  season: string;
  /** Music searches used for the last few stories, so the next one is different. */
  recentMusic: string[];
}

/** The AI jobs the app uses. */
export interface AiProvider {
  /** Reads ticket text into structured data. */
  /** Reads a ticket. The same text is answered from memory unless `fresh` is set (a rescan). */
  extractTicket(text: string, fresh?: boolean): Promise<Result<ExtractedData>>;
  /** The dates of the holidays that move, for one year. Each date is checked before it is returned. */
  holidayDates(year: number, slugs: string[]): Promise<Result<MovingDates>>;
  /** The mood of a story: a few captions, picture searches and one music search. The reply is checked before it is returned. */
  storyTheme(input: StoryThemeInput): Promise<Result<StoryTheme>>;
  /** Turns a plain-language question about the log into filters. */
  askLog(question: string): Promise<Result<{ filter: LogFilter; plan: AskPlan }>>;
}
