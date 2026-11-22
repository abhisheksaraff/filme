// lib/ports/storyViews.ts
import type { Result } from "./result";

export interface FinishedStory {
  kind: string;
  period: string;
  /** When it was first watched to the end. */
  at: string;
}

/** Which Home stories have been watched to the end; stored in the database so every device agrees. */
export interface StoryViewRepository {
  finished(): Promise<Result<FinishedStory[]>>;
  /** Remembers that a story was watched to the end. Watching it again changes nothing. */
  markFinished(kind: string, period: string): Promise<Result<void>>;
}
