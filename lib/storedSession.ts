// lib/storedSession.ts
// Whether this phone holds a saved sign-in, read straight from storage with no waiting. Supabase keeps its session
// under a key like sb-<project>-auth-token. This is only a hint used to draw the page at once; the real check still runs.
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { access_token?: unknown; currentSession?: { access_token?: unknown } } | null;
      if (value && (typeof value.access_token === "string" || typeof value.currentSession?.access_token === "string")) return true;
    }
  } catch {
    // Storage can be refused; the page then waits for the real check as before.
  }
  return false;
}
