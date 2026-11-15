// lib/debug.ts
// A short log for the temporary debug story: what the picture and music searches did, and what the browser's security
// policy blocked. Kept in memory only. Remove with the debug story.

const lines: string[] = [];
let bypass = false;

export function debugLog(line: string): void {
  lines.push(line.length > 80 ? `${line.slice(0, 79)}…` : line);
  if (lines.length > 40) lines.shift();
}

export const readDebugLog = (): string[] => [...lines];

/** While on, searches ignore what the phone saved earlier, so each open of the debug story really asks again. */
export const setDebugBypass = (on: boolean): void => {
  bypass = on;
};
export const debugBypass = (): boolean => bypass;

if (typeof document !== "undefined") {
  document.addEventListener("securitypolicyviolation", (e) => {
    debugLog(`BLOCKED ${e.effectiveDirective}: ${e.blockedURI.slice(0, 70)}`);
  });
}
