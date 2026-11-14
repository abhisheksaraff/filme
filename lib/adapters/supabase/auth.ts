// lib/adapters/supabase/auth.ts
import { getSupabase } from "./client";

/** Signs in with email and password; sign-ups are disabled in Supabase, so this is the only way in. */
export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  // Deliberately generic: do not reveal whether the email or the password was wrong.
  return { error: error ? "That email and password did not match." : null };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function hasSession(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return data.session !== null;
}
