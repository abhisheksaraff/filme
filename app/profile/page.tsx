// app/profile/page.tsx
// Your picture, storage use, and everything that is not logging or browsing.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import RoundButton from "@/components/RoundButton";
import Icon, { type IconName } from "@/components/Icon";
import CropDialog from "@/components/CropDialog";
import DataSync from "@/components/DataSync";
import { useRequireSession } from "@/hooks/useRequireSession";
import { allStores } from "@/lib/files";
import { services } from "@/lib/services";

const LINKS: { href: string; label: string; note: string; icon: IconName }[] = [
  { href: "/stats/", icon: "chart", label: "Stats", note: "Totals and charts for everything you have logged" },
  { href: "/map/", icon: "map", label: "Map", note: "Every venue you have been to" },
  { href: "/collections/", icon: "layers", label: "Collections", note: "Your own lists of titles" },
  { href: "/profile/appearance/", icon: "palette", label: "Appearance", note: "Light or dark, themes and decorations" },
  { href: "/profile/data/", icon: "archive", label: "Import and export", note: "Letterboxd and Trakt files" },
  { href: "/profile/keys/", icon: "key", label: "API keys", note: "AI and TMDB keys, models and order" },
];

/** The free 10 GB of the image store; the meter is measured against that. */
const FREE_BYTES = 10_000_000_000;

const size = (bytes: number) => (bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`);

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
    // Images may be in either store while they are being moved, so both count.
    Promise.all(allStores.map((store) => store.usage())).then((results) => {
      if (!cancelled && results.every((res) => res.ok)) setUsed(results.reduce((sum, res) => sum + (res.ok ? res.value : 0), 0));
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
    await services.auth.signOut();
    router.replace("/login/");
  }

  if (!ready) return null;
  const share = used === null ? 0 : Math.min(100, (used / FREE_BYTES) * 100);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Profile</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <div className="flex items-center gap-4">
        <Avatar key={avatarKey} size={72} />
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { setCrop(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <RoundButton icon="edit" label="Change picture" onClick={() => input.current?.click()} />
      </div>

      <section className="flex flex-col gap-1 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        <span className="text-neutral-500">Storage used</span>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
          <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${share}%` }} />
        </div>
        <span>{used === null ? "Checking…" : `${size(used)} of ${size(FREE_BYTES)}`}</span>
      </section>

      <ul className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center gap-4 rounded-full bg-neutral-100 py-2 pl-2 pr-5 dark:bg-neutral-900">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name={link.icon} size={20} /></span>
              <span className="flex flex-col">
                <span className="font-medium">{link.label}</span>
                <span className="text-xs text-neutral-500">{link.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <DataSync />

      <RoundButton icon="logout" label="Sign out" onClick={onSignOut} className="self-center" size="lg" />

      {crop && <CropDialog file={crop} aspect={1} maxEdge={512} title="Frame your picture" onCancel={() => setCrop(null)} onDone={saveAvatar} />}
    </main>
  );
}
