// lib/domain/time.ts
// A time of day is kept as text such as "7:30 PM". The time box works in "19:30", so these turn one into the other.

/** "7:30 PM", "19:30", "7 pm" or "19:30:00" as "19:30"; "" when it is not a clock time ("evening"). */
export function toTimeInput(text: string | null | undefined): string {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])?\.?m?\.?\s*$/i.exec(text ?? "");
  if (!m) return "";
  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? "0");
  const half = m[3]?.toLowerCase();
  if (minutes > 59 || hours > 23) return "";
  if (half) {
    if (hours < 1 || hours > 12) return "";
    hours = (hours % 12) + (half === "p" ? 12 : 0);
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "19:30" as "7:30 PM", the way times are saved and shown. */
export function fromTimeInput(value: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(value);
  if (!m) return "";
  const hours = Number(m[1]);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${m[2]} ${hours >= 12 ? "PM" : "AM"}`;
}
