// app/(public)/login/page.tsx
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { FIELD_FULL } from "@/components/ui/fields";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { services } from "@/lib/services";
import RoundButton from "@/components/RoundButton";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await services.auth.signIn(String(form.get("email")), String(form.get("password")));
      if (result.error) setError(result.error);
      else router.replace("/home/");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // 16px inputs stop iOS Safari from zooming the page on focus.
  const field = FIELD_FULL;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <RoundButton icon="back" label="Back" href="/" />
      <h1 className="font-serif text-4xl tracking-tight">Log in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input name="email" type="email" autoComplete="username" placeholder="Email" required className={field} />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" required className={field} />
        <ProblemPopup message={error} onClose={() => setError(null)} />
        <button
          type="submit"
          disabled={busy}
          className="w-48 self-center rounded-full bg-neutral-900 px-10 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
