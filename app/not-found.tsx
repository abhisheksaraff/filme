// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-serif text-4xl tracking-tight">Page not found</h1>
      <p className="text-neutral-600 dark:text-neutral-400">That page does not exist, or the link is out of date.</p>
      <Link href="/home/" className="text-sm underline">Go to Home</Link>
    </main>
  );
}
