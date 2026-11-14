// lib/ics.ts
// Builds calendar files (.ics) that Apple Calendar and others can import.

export interface IcsEvent {
  /** Stable id so importing twice updates instead of duplicating. */
  uid: string;
  title: string;
  /** YYYY-MM-DD. All-day events are used because most tickets only have a date. */
  date: string;
  description?: string | null;
  location?: string | null;
}

/** Escapes the characters the format treats specially. */
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const compact = (date: string) => date.replaceAll("-", "");

/** The day after a YYYY-MM-DD date; all-day events end on the following day. */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export function buildIcs(name: string, events: IcsEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//filme//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(name)}`];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@filme`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(event.date))}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Downloads text as a file; used for calendars and exports. */
export function downloadText(filename: string, text: string, type = "text/calendar"): void {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
