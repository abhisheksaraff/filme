// app/profile/keys/page.tsx
// Manage providers, their model lists and their API keys. Keys are sent once and never shown again.
"use client";

import { FIELD_FULL } from "@/components/ui/fields";
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
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const input = FIELD_FULL;
const small = "rounded-xl bg-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:bg-neutral-700";
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

const MAX_ITEMS = 20;
const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,80}$/;

/** One entry per non-empty line, trimmed, keeping the first of any duplicates. */
function uniqueLines(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

interface SectionProps {
  provider: KeyProvider;
  config: KeyConfig;
  busy: boolean;
  run: Run;
  onTest: (id?: string) => void;
}

function ProviderSection({ provider, config, busy, run, onTest }: SectionProps) {
  const keys = config.keys.filter((k) => k.provider === provider);
  const savedModels = isAiProvider(provider)
    ? config.models.filter((m) => m.provider === provider).map((m) => m.model)
    : [];

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const secrets = uniqueLines(String(form.get("secrets") ?? ""));
    const models = isAiProvider(provider) ? uniqueLines(String(form.get("models") ?? "")) : null;

    const saved = await run(async () => {
      if (models) {
        if (models.length > MAX_ITEMS) return fail(`Use at most ${MAX_ITEMS} models.`);
        const bad = models.find((m) => !MODEL_NAME.test(m));
        if (bad) return fail(`"${bad}" is not a valid model name.`);
      }
      // Keys first: they are checked all together, so a bad one stops everything before any change.
      if (secrets.length > 0) {
        const added = await services.keys.addKeys(provider, secrets);
        if (!added.ok) return added;
      }
      if (models && (models.join("\n") !== savedModels.join("\n"))) {
        const set = await services.keys.setModels(provider as AiKeyProvider, models);
        if (!set.ok) return set;
      }
      return ok(undefined);
    }, "Saved.");

    if (saved) {
      const box = formEl.elements.namedItem("secrets");
      if (box instanceof HTMLTextAreaElement) box.value = "";
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="font-serif text-xl">{PROVIDER_LABELS[provider]}</h2>

      <form onSubmit={onSave} className="flex flex-col gap-4">
        {isAiProvider(provider) && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Models, one per line (tried top to bottom)</span>
            {savedModels.length === 0 && (
              <span className="text-sm text-amber-600">Add at least one model, or this provider is skipped.</span>
            )}
            {/* Remounts with the saved list whenever it changes, so the box always shows what is stored. */}
            <textarea
              key={savedModels.join("\n")}
              name="models"
              defaultValue={savedModels.join("\n")}
              rows={Math.max(3, savedModels.length + 1)}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className={`${input} font-mono text-sm`}
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Add keys, one per line (tried in this order, after the ones already saved)</span>
          <textarea
            name="secrets"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className={`${input} font-mono text-sm`}
          />
        </label>

        <button type="submit" disabled={busy} className={primary}>{busy ? "Working…" : "Check and save"}</button>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Saved keys (tried top to bottom)</h3>
        {keys.length === 0 && <p className="text-sm text-neutral-500">No keys saved yet.</p>}
        <ul className="flex flex-col gap-2">
          {keys.map((k, i) => (
            <li key={k.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 dark:bg-neutral-800">
              <span className="text-sm">Key …{k.hint}</span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                <button type="button" className={small} disabled={busy || i === 0}
                  onClick={() => { const next = moved(keys, i, -1); if (next) void run(() => services.keys.reorderKeys(next.map((x) => x.id))); }}>↑</button>
                <button type="button" className={small} disabled={busy || i === keys.length - 1}
                  onClick={() => { const next = moved(keys, i, 1); if (next) void run(() => services.keys.reorderKeys(next.map((x) => x.id))); }}>↓</button>
                <button type="button" className={small} disabled={busy} onClick={() => onTest(k.id)}>Test</button>
                <button type="button" className={small} disabled={busy}
                  onClick={() => run(() => services.keys.removeKey(k.id), "Key removed.")}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
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
