// app/profile/keys/page.tsx
// Manage providers, their model lists and their API keys. Keys are sent once and never shown again.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import {
  KEY_PROVIDERS,
  PROVIDER_LABELS,
  isAiProvider,
  type AiKeyProvider,
  type KeyConfig,
  type KeyProvider,
} from "@/lib/domain/keys";
import type { Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const input =
  "w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base dark:border-neutral-700";
const small = "rounded-xl border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700";
const primary =
  "rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";

/** Returns a copy of `list` with the item at `index` swapped with its neighbour. */
function moved<T>(list: T[], index: number, by: -1 | 1): T[] | null {
  const target = index + by;
  if (target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type Run = (action: () => Promise<Result<unknown>>, success?: string) => Promise<boolean>;

interface SectionProps {
  provider: KeyProvider;
  config: KeyConfig;
  busy: boolean;
  run: Run;
  onTest: (id?: string) => void;
}

function ProviderSection({ provider, config, busy, run, onTest }: SectionProps) {
  const keys = config.keys.filter((k) => k.provider === provider);
  const models = isAiProvider(provider) ? config.models.filter((m) => m.provider === provider) : [];

  async function onAddKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const saved = await run(
      () =>
        services.keys.addKey({
          provider,
          label: String(form.get("label") ?? "") || undefined,
          secret: String(form.get("secret") ?? ""),
        }),
      "Key saved.",
    );
    if (saved) formEl.reset();
  }

  async function onAddModel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAiProvider(provider)) return;
    const formEl = e.currentTarget;
    const model = String(new FormData(formEl).get("model") ?? "").trim();
    if (!model) return;
    const saved = await run(() => services.keys.addModel(provider, model));
    if (saved) formEl.reset();
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="font-serif text-xl">{PROVIDER_LABELS[provider]}</h2>

      {isAiProvider(provider) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Models (tried top to bottom)</h3>
          {models.length === 0 && (
            <p className="text-sm text-amber-600">Add at least one model, or this provider is skipped.</p>
          )}
          <ul className="flex flex-col gap-2">
            {models.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="break-all text-sm">{m.model}</span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" className={small} disabled={busy || i === 0}
                    onClick={() => { const next = moved(models, i, -1); if (next) void run(() => services.keys.reorderModels(provider, next.map((x) => x.id))); }}>↑</button>
                  <button type="button" className={small} disabled={busy || i === models.length - 1}
                    onClick={() => { const next = moved(models, i, 1); if (next) void run(() => services.keys.reorderModels(provider, next.map((x) => x.id))); }}>↓</button>
                  <button type="button" className={small} disabled={busy}
                    onClick={() => run(() => services.keys.removeModel(m.id))}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddModel} className="flex gap-2">
            <input name="model" placeholder="Model name" className={input} autoCapitalize="none" autoCorrect="off" />
            <button type="submit" disabled={busy} className={small}>Add</button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Keys (tried top to bottom)</h3>
        {keys.length === 0 && <p className="text-sm text-neutral-500">No keys saved yet.</p>}
        <ul className="flex flex-col gap-2">
          {keys.map((k, i) => (
            <li key={k.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{k.label || "Key"}</span>
                <span className="text-xs text-neutral-500">…{k.hint}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={small} disabled={busy || i === 0}
                  onClick={() => { const next = moved(keys, i, -1); if (next) void run(() => services.keys.reorderKeys(next.map((x) => x.id))); }}>↑</button>
                <button type="button" className={small} disabled={busy || i === keys.length - 1}
                  onClick={() => { const next = moved(keys, i, 1); if (next) void run(() => services.keys.reorderKeys(next.map((x) => x.id))); }}>↓</button>
                <button type="button" className={small} disabled={busy} onClick={() => onTest(k.id)}>Test</button>
                <button type="button" className={small} disabled={busy}
                  onClick={() => run(() => services.keys.removeKey(k.id), "Key removed.")}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddKey} className="flex flex-col gap-2">
          <input name="label" placeholder="Label (optional)" maxLength={60} className={input} />
          <input name="secret" type="password" autoComplete="off" placeholder="Paste the key" required className={input} />
          <button type="submit" disabled={busy} className={primary}>{busy ? "Working…" : "Check and save key"}</button>
        </form>
      </div>
    </section>
  );
}

export default function KeysPage() {
  const ready = useRequireSession();
  const [config, setConfig] = useState<KeyConfig>({ keys: [], models: [], providerOrder: ["gemini", "openai", "claude"] });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await services.keys.load();
    if (res.ok) setConfig(res.value);
    else setMessage(res.error);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [ready, load]);

  const run: Run = async (action, success) => {
    setBusy(true);
    setMessage(null);
    const res = await action();
    setMessage(res.ok ? (success ?? null) : res.error);
    await load();
    setBusy(false);
    return res.ok;
  };

  async function onTest(id?: string) {
    setBusy(true);
    setMessage(null);
    const res = await services.keys.testKeys(id);
    setMessage(
      res.ok
        ? res.value.map((r) => `${PROVIDER_LABELS[r.provider]}: ${r.message}`).join(" • ") || "No keys to test."
        : res.error,
    );
    setBusy(false);
  }

  if (!ready) return null;

  const order = config.providerOrder;
  const swapProvider = (index: number, by: -1 | 1) => {
    const next = moved<AiKeyProvider>(order, index, by);
    if (next) void run(() => services.keys.reorderProviders(next));
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <Link href="/watchlist/" className="text-sm text-neutral-500">← Back</Link>
      <h1 className="font-serif text-3xl tracking-tight">API keys</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Keys are stored encrypted on the server and never shown again. A scan tries providers in the order
        below; for each provider it tries every model, and for each model every key.
      </p>

      {message && <p role="status" className="text-sm">{message}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl">Provider order</h2>
        <ul className="flex flex-col gap-2">
          {order.map((p, i) => (
            <li key={p} className="flex items-center justify-between">
              <span className="text-sm">{i + 1}. {PROVIDER_LABELS[p]}</span>
              <span className="flex gap-1">
                <button type="button" className={small} disabled={busy || i === 0} onClick={() => swapProvider(i, -1)}>↑</button>
                <button type="button" className={small} disabled={busy || i === order.length - 1} onClick={() => swapProvider(i, 1)}>↓</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {[...order, ...KEY_PROVIDERS.filter((p) => !isAiProvider(p))].map((provider) => (
        <ProviderSection key={provider} provider={provider} config={config} busy={busy} run={run} onTest={onTest} />
      ))}

      {config.keys.length > 1 && (
        <button type="button" className={small} disabled={busy} onClick={() => onTest()}>Test all keys</button>
      )}
    </main>
  );
}
