// lib/domain/years.ts
// The years a year box offers.

/** The first year anything was filmed: a little before 1900. */
export const FIRST_YEAR = 1850;

/** Years for a year box, newest first: `ahead` years past this one (films not out yet), back to 1850. */
export function yearChoices(ahead = 0, now: Date = new Date()): number[] {
  const last = now.getFullYear() + ahead;
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => last - i);
}
