// app/(public)/page.tsx
import Wordmark from "@/components/Wordmark";
import Link from "next/link";
import SignedInRedirect from "@/components/SignedInRedirect";

export default function WelcomePage() {
  return (
    <SignedInRedirect>
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <h1><Wordmark className="text-5xl" /></h1>
      <p className="text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        A private log of the films, shows and concerts I have seen, with the ticket stubs to prove it.
      </p>
      <Link
        href="/login/"
        data-press
        className="w-48 self-center rounded-full bg-neutral-900 px-10 py-3 text-center text-base font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Log in
      </Link>
    </main>
    </SignedInRedirect>
  );
}
