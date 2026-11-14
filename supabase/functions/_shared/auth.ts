// supabase/functions/_shared/auth.ts
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

/** Client with the service_role key: bypasses RLS, so it must never be handed to user input. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Identifies the signed-in caller by asking the Auth server to validate their token. */
export async function requireUser(req: Request): Promise<{ userId: string }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in first.");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Sign in again.");
  return { userId: data.user.id };
}

/** Counts this call against today's limit and refuses once it is used up. */
export async function enforceLimit(userId: string, fn: string, perDay: number): Promise<void> {
  const { data, error } = await adminClient().rpc("app_bump_usage", {
    p_user: userId,
    p_fn: fn,
    p_limit: perDay,
  });
  if (error) throw new HttpError(500, "Could not check the daily limit.");
  if (data !== true) throw new HttpError(429, `Daily limit reached for ${fn}. Try again tomorrow.`);
}
