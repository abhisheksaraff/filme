// app/(public)/login/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "@/lib/adapters/supabase/auth";

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
      const result = await signIn(String(form.get("email")), String(form.get("password")));
      if (result.error) setError(result.error);
      else router.replace("/watchlist/");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // 16px inputs stop iOS Safari from zooming the page on focus.
  const field =
    "w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <Link href="/" className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-4xl tracking-tight">Log in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input name="email" type="email" autoComplete="username" placeholder="Email" required className={field} />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" required className={field} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
