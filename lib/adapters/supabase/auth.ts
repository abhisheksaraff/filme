// lib/adapters/supabase/auth.ts
import type { AuthError } from "@supabase/supabase-js";
import type { AuthProvider } from "@/lib/ports/auth";
import { getSupabase } from "./client";

/**
 * Separates "wrong credentials" from "the app cannot reach Supabase", which once looked identical.
 * SECURITY: wrong email and wrong password still share one message, so accounts cannot be probed.
 */
function describeSignInError(error: AuthError): string {
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (error.status === 404) return "The app is pointed at the wrong Supabase URL. Check NEXT_PUBLIC_SUPABASE_URL.";
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (error.code === "email_not_confirmed") return "This account's email has not been confirmed in Supabase yet.";
  if (error.code === "invalid_credentials") return "That email and password did not match.";
  return "Could not log in. Try again in a moment.";
}

/** Signs in with email and password; sign-ups are disabled in Supabase, so this is the only way in. */
export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { error: error ? describeSignInError(error) : null };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function hasSession(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return data.session !== null;
}

export const supabaseAuth: AuthProvider = { signIn, signOut, hasSession };
