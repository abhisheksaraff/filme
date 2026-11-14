// app/profile/page.tsx
// Your picture, storage use, and everything that is not logging or browsing.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import CropDialog from "@/components/CropDialog";
import { useRequireSession } from "@/hooks/useRequireSession";
import { getSupabase } from "@/lib/adapters/supabase/client";
import { signOut } from "@/lib/adapters/supabase/auth";
import { services } from "@/lib/services";

const LINKS = [
  { href: "/stats/", label: "Stats", note: "Totals and charts for everything you have logged" },
  { href: "/globe/", label: "Globe", note: "Every venue you have been to" },
  { href: "/collections/", label: "Collections", note: "Your own lists of titles" },
  { href: "/profile/appearance/", label: "Appearance", note: "Light or dark, themes and decorations" },
  { href: "/profile/data/", label: "Your data", note: "Backups, restore, Letterboxd and Trakt files" },
  { href: "/profile/keys/", label: "API keys", note: "AI and TMDB keys, models and order" },
];

/** Supabase's free plan holds 1 GB of files; the meter is measured against that. */
const FREE_BYTES = 1_000_000_000;

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0);

export default function ProfilePage() {
  const ready = useRequireSession();
  const router = useRouter();
  const [used, setUsed] = useState<number | null>(null);
  const [crop, setCrop] = useState<File | null>(null);
  const [avatarKey, setAvatarKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getSupabase().rpc("my_storage_bytes").then(({ data, error }) => {
      if (!cancelled && !error) setUsed(Number(data ?? 0));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, avatarKey]);

  async function saveAvatar(blob: Blob) {
    setCrop(null);
    const res = await services.images.setAvatar(blob);
    if (res.ok) setAvatarKey((n) => n + 1);
    else setProblem(res.error);
  }

  async function onSignOut() {
    await signOut();
    router.replace("/login/");
  }

  if (!ready) return null;
  const share = used === null ? 0 : Math.min(100, (used / FREE_BYTES) * 100);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-32 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Profile</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <div className="flex items-center gap-4">
        <Avatar key={avatarKey} size={72} />
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { setCrop(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} className="rounded-full border border-neutral-400 px-4 py-1.5 text-sm">Change picture</button>
      </div>

      <section className="flex flex-col gap-1 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        <span className="text-neutral-500">Storage used</span>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
          <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${share}%` }} />
        </div>
        <span>{used === null ? "Checking…" : `${megabytes(used)} MB of ${megabytes(FREE_BYTES)} MB`}</span>
      </section>

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
      <button type="button" onClick={onSignOut} className="rounded-xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700">Sign out</button>

      {crop && <CropDialog file={crop} aspect={1} maxEdge={512} title="Frame your picture" onCancel={() => setCrop(null)} onDone={saveAvatar} />}
      <BottomNav />
    </main>
  );
}
