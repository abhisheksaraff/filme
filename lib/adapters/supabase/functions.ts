// lib/adapters/supabase/functions.ts
// The one place that calls Edge Functions, turning every failure into a readable message.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { fail, ok, type Result } from "@/lib/ports/result";
import { getSupabase } from "./client";

/** Calls an Edge Function with the signed-in user's token and returns its JSON reply. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await getSupabase().functions.invoke(name, { body });
    if (!error) return ok(data as T);

    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      if (detail && typeof detail.error === "string") return fail(detail.error);
      return fail(`The ${name} service answered with an error.`);
    }
    if (error instanceof FunctionsFetchError) return fail("Could not reach the server. Check your connection.");
    if (error instanceof FunctionsRelayError) return fail("The service is not available right now. Try again shortly.");
    return fail("Something went wrong calling the server.");
  } catch {
    return fail("Could not reach the server. Check your connection.");
  }
}
