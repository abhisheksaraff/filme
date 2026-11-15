// lib/same.ts
// Keeps what is already on screen when a fresh answer says the same thing, so nothing re-renders or re-animates for no reason.

/** The old value when it holds the same content as the new one, otherwise the new one. */
export function keepIfSame<T>(previous: T, next: T): T {
  if (previous === next) return previous;
  try {
    return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
  } catch {
    return next;
  }
}
