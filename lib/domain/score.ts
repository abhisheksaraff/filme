// lib/domain/score.ts
// How a rating is written everywhere in the app: one decimal at most, and a whole number without ".0" (7.0 reads 7, 7.25 reads 7.3).

export const formatScore = (n: number): string => String(Math.round(n * 10) / 10);
