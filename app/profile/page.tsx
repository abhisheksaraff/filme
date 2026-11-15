// app/profile/page.tsx
// Your picture, storage use, and everything that is not logging or browsing.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import RoundButton from "@/components/RoundButton";
import Icon, { type IconName } from "@/components/Icon";
import CropDialog from "@/components/CropDialog";
import DataSync from "@/components/DataSync";
import { ConfirmPopup } from "@/components/Popup";
import { useRequireSession } from "@/hooks/useRequireSession";
import { allStores } from "@/lib/files";
import { fail, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const LINKS: { href: string; label: string; note: string; icon: IconName }[] = [
  { href: "/stats/", icon: "chart", label: "Stats", note: "Totals and charts for everything you have logged" },
  { href: "/profile/appearance/", icon: "palette", label: "Appearance", note: "Light or dark, themes and decorations" },
  { href: "/profile/data/", icon: "archive", label: "Import and export", note: "Letterboxd and Trakt files" },
  { href: "/profile/hidden/", icon: "close", label: "Not interested", note: "Titles hidden from Home, with undo" },
  { href: "/profile/watch/", icon: "watch", label: "Watch link", note: "Which website the Watch button opens" },
  { href: "/profile/keys/", icon: "key", label: "API keys", note: "AI and TMDB keys, models and order" },
];

const ROW = "flex items-center gap-4 rounded-full bg-neutral-100 py-2 pl-2 pr-5 dark:bg-neutral-900";

function RowBody({ icon, label, note }: { icon: IconName; label: string; note: string }) {
  return (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name={icon} size={20} /></span>
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-neutral-500">{note}</span>
      </span>
    </>
  );
}

/** The free 10 GB of the image store; the meter is measured against that. */
const FREE_BYTES = 10_000_000_000;
/** How long a store may take to report its size before the meter goes on without it. */
const STORE_WAIT_MS = 8000;

const size = (bytes: number) => (bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`);

export default function ProfilePage() {
  const ready = useRequireSession();
  const router = useRouter();
  // null while checking; "none" when no store answered; otherwise the bytes found and any store that did not answer.
  const [storage, setStorage] = useState<{ bytes: number; missing: string[] } | "none" | null>(null);
  const [crop, setCrop] = useState<File | null>(null);
  const [avatarKey, setAvatarKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [hasAvatar, setHasAvatar] = useState(false);
  const [confirmAvatar, setConfirmAvatar] = useState(false);
  const [removing, setRemoving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Images may be in either store while they are being moved, so both count. A store that does not
    // answer within a few seconds is reported instead of holding the meter on "Checking…".
    const within = (job: Promise<Result<number>>) =>
      Promise.race([job, new Promise<Result<number>>((resolve) => setTimeout(() => resolve(fail("No answer.")), STORE_WAIT_MS))]);
    Promise.all(allStores.map(async (store) => ({ id: store.id, res: await within(store.usage()) }))).then((list) => {
      if (cancelled) return;
      const answered = list.flatMap((item) => (item.res.ok ? [item.res.value] : []));
      const missing = list.filter((item) => !item.res.ok).map((item) => (item.id === "files" ? "B2" : "Supabase"));
      setStorage(answered.length === 0 ? "none" : { bytes: answered.reduce((a, b) => a + b, 0), missing });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, avatarKey]);

  // Whether an uploaded picture exists, so the remove button shows only then.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.images.avatar().then((res) => {
      if (!cancelled) setHasAvatar(res.ok && res.value !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, avatarKey]);

  async function removeAvatar() {
    setRemoving(true);
    const res = await services.images.removeAvatar();
    setRemoving(false);
    setConfirmAvatar(false);
    if (res.ok) setAvatarKey((n) => n + 1);
    else setProblem(res.error);
  }

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
  const used = storage === null || storage === "none" ? null : storage.bytes;
  const share = used === null ? 0 : Math.min(100, (used / FREE_BYTES) * 100);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Profile</h1>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      <div className="flex items-center gap-4">
        <Avatar key={avatarKey} size={72} />
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { setCrop(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <RoundButton icon="edit" label="Change picture" onClick={() => input.current?.click()} />
        {hasAvatar && <RoundButton icon="trash" label="Remove picture" tone="danger" onClick={() => setConfirmAvatar(true)} />}
      </div>

      <section className="flex flex-col gap-1 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        <span className="text-neutral-500">Storage used</span>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
          <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${share}%` }} />
        </div>
        <span>
          {storage === null ? "Checking…" : storage === "none" ? "Not available right now" : `${size(storage.bytes)} of ${size(FREE_BYTES)}`}
          {storage !== null && storage !== "none" && storage.missing.length > 0 && <span className="text-neutral-500"> · {storage.missing.join(", ")} not reachable</span>}
        </span>
      </section>

      <ul className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={ROW}>
              <RowBody icon={link.icon} label={link.label} note={link.note} />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setConfirmOut(true)} className={`${ROW} w-full text-left`}>
            <RowBody icon="logout" label="Sign out" note="Sign out of this device" />
          </button>
        </li>
      </ul>
      <DataSync />

      {confirmAvatar && (
        <ConfirmPopup title="Remove your picture?" message="The default picture shows again." confirmLabel="Remove" confirmIcon="trash" busy={removing} onConfirm={removeAvatar} onCancel={() => setConfirmAvatar(false)} />
      )}
      {confirmOut && (
        <ConfirmPopup title="Sign out?" message="You will need to sign in again to see your log on this device." confirmLabel="Sign out" confirmIcon="logout" onConfirm={onSignOut} onCancel={() => setConfirmOut(false)} />
      )}

      {crop && <CropDialog file={crop} aspect={1} maxEdge={512} title="Frame your picture" onCancel={() => setCrop(null)} onDone={saveAvatar} />}
    </main>
  );
}
