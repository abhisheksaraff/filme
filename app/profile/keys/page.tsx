// app/profile/keys/page.tsx
// Manage the API keys the Edge Functions use. Keys are sent once to be stored and never shown again.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import {
  KEY_PROVIDERS,
  PROVIDER_LABELS,
  isAiProvider,
  type KeyProvider,
  type KeySummary,
} from "@/lib/domain/keys";
import { services } from "@/lib/services";

const input =
  "w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700";
const button =
  "rounded-xl border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-neutral-700";

export default function KeysPage() {
  const ready = useRequireSession();
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [provider, setProvider] = useState<KeyProvider>("gemini");
  const [models, setModels] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await services.keys.list();
    if (res.ok) setKeys(res.value);
    else setMessage(res.error);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [ready, load]);

  function pickProvider(next: KeyProvider) {
    setProvider(next);
    setModels("");
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(true);
    setMessage(null);
    const res = await action();
    setMessage(res.ok ? (success ?? null) : (res.error ?? "Something went wrong."));
    await load();
    setBusy(false);
  }

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const modelList = models.split(",").map((m) => m.trim()).filter(Boolean);
    await run(async () => {
      const res = await services.keys.add({
        provider,
        label: String(form.get("label") ?? "") || undefined,
        models: isAiProvider(provider) ? modelList : [],
        secret: String(form.get("secret") ?? ""),
      });
      if (res.ok) formEl.reset();
      return res.ok ? res : { ok: false, error: res.error };
    }, "Key saved.");
  }

  function move(index: number, by: -1 | 1) {
    const ids = keys.map((k) => k.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => services.keys.reorder(ids));
  }

  async function onTest(id?: string) {
    setBusy(true);
    setMessage(null);
    const res = await services.keys.test(id);
    setMessage(res.ok ? res.value.map((r) => `${PROVIDER_LABELS[r.provider]}: ${r.message}`).join(" • ") || "No keys to test." : res.error);
    setBusy(false);
  }

  if (!ready) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <Link href="/watchlist/" className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-3xl tracking-tight">API keys</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Keys are stored encrypted on the server and are never shown again. AI keys are tried top to bottom,
        and within a key each model is tried in the order listed.
      </p>

      {message && <p role="status" className="text-sm">{message}</p>}

      <ul className="flex flex-col gap-3">
        {keys.map((k, i) => (
          <li key={k.id} className="flex flex-col gap-2 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{k.label || PROVIDER_LABELS[k.provider]}</span>
              <span className="text-xs text-neutral-500">…{k.hint}</span>
            </div>
            <span className="text-xs text-neutral-500">
              {PROVIDER_LABELS[k.provider]}
              {k.models.length > 0 && ` · ${k.models.join(", ")}`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || i === 0} onClick={() => move(i, -1)}>Up</button>
              <button type="button" className={button} disabled={busy || i === keys.length - 1} onClick={() => move(i, 1)}>Down</button>
              <button type="button" className={button} disabled={busy} onClick={() => onTest(k.id)}>Test</button>
              <button type="button" className={button} disabled={busy} onClick={() => run(() => services.keys.remove(k.id), "Key removed.")}>Remove</button>
            </div>
          </li>
        ))}
        {keys.length === 0 && <li className="text-sm text-neutral-500">No keys saved yet.</li>}
      </ul>

      {keys.length > 1 && (
        <button type="button" className={button} disabled={busy} onClick={() => onTest()}>Test all keys</button>
      )}

      <form onSubmit={onAdd} className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">Add a key</h2>
        <select value={provider} onChange={(e) => pickProvider(e.target.value as KeyProvider)} className={input}>
          {KEY_PROVIDERS.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
        <input name="label" placeholder="Label (optional)" maxLength={60} className={input} />
        {isAiProvider(provider) && (
          <input
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder="Models, comma separated, tried in order"
            className={input}
            required
          />
        )}
        <input name="secret" type="password" autoComplete="off" placeholder="Paste the key" required className={input} />
        <button type="submit" disabled={busy} className="rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {busy ? "Working…" : "Check and save"}
        </button>
      </form>
    </main>
  );
}
