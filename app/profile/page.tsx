// app/profile/page.tsx
// Everything that is not logging or browsing: stats, collections, look, keys and sign out.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useRequireSession } from "@/hooks/useRequireSession";
import { signOut } from "@/lib/adapters/supabase/auth";

const LINKS = [
  { href: "/stats/", label: "Stats", note: "Totals and charts for everything you have logged" },
  { href: "/collections/", label: "Collections", note: "Your own lists of titles" },
  { href: "/profile/appearance/", label: "Appearance", note: "Light or dark, and holiday themes" },
  { href: "/profile/keys/", label: "API keys", note: "AI and TMDB keys, models and order" },
];

export default function ProfilePage() {
  const ready = useRequireSession();
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/login/");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-28 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Profile</h1>
      <ul className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex flex-col rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
              <span className="font-medium">{link.label}</span>
              <span className="text-sm text-neutral-500">{link.note}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700"
      >
        Sign out
      </button>
      <BottomNav />
    </main>
  );
}
