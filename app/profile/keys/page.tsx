// app/profile/keys/page.tsx
// Manage providers, their model lists and their API keys. Keys are sent once and never shown again.
"use client";

import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { AREA } from "@/components/ui/fields";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import {
  KEY_PROVIDERS,
  PROVIDER_LABELS,
  isAiProvider,
  type AiKeyProvider,
  type KeyConfig,
  type KeySummary,
  type KeyProvider,
} from "@/lib/domain/keys";
import { fail, ok, type Result } from "@/lib/ports/result";
import { services } from "@/lib/services";

const small = "rounded-2xl bg-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:bg-neutral-700";
const primary =
  "rounded-2xl bg-neutral-900 px-5 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900 wide:w-60 wide:self-center";

/** Returns a copy of `list` with the item at `index` swapped with its neighbour. */
function moved<T>(list: T[], index: number, by: -1 | 1): T[] | null {
  const target = index + by;
  if (target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Runs a change while everything else waits, then reloads the saved keys; the caller shows what came of it. */
type Run = (action: () => Promise<Result<unknown>>) => Promise<Result<unknown>>;

const MAX_ITEMS = 20;
const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,80}$/;

/** One entry per non-empty line, trimmed, keeping the first of any duplicates. */
function uniqueLines(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

/** A green tick or a red cross; nothing at all for a key nobody has used or tested yet. */
function Mark({ ok, label }: { ok: boolean | null; label?: string | null }) {
  if (ok === null) return null;
  return (
    <span title={label ?? (ok ? "Working" : "Not working")} role="img" aria-label={ok ? "Working" : "Not working"} className={`inline-flex shrink-0 ${ok ? "text-green-600" : "text-red-600"}`}>
      <Icon name={ok ? "check" : "close"} size={18} />
    </span>
  );
}

/** How a provider's keys look together: a cross if any failed, a tick if any has worked, nothing if none has been tried. */
function summaryOf(keys: KeySummary[]): boolean | null {
  if (keys.some((k) => k.lastOk === false)) return false;
  if (keys.some((k) => k.lastOk === true)) return true;
  return null;
}

interface SectionProps {
  provider: KeyProvider;
  config: KeyConfig;
  busy: boolean;
  /** Ids of the keys being tested right now. */
  testing: string[];
  run: Run;
  onTest: (ids: string[]) => void;
}

function ProviderSection({ provider, config, busy, testing, run, onTest }: SectionProps) {
  const [open, setOpen] = useState(false);
  // What came of the last save, shown under its own button.
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);
  const keys = config.keys.filter((k) => k.provider === provider);
  const savedModels = isAiProvider(provider)
    ? config.models.filter((m) => m.provider === provider).map((m) => m.model)
    : [];
  const summary = summaryOf(keys);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const secrets = uniqueLines(String(form.get("secrets") ?? ""));
    const models = isAiProvider(provider) ? uniqueLines(String(form.get("models") ?? "")) : null;
    setSaveNote(null);

    const res = await run(async () => {
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
    });

    if (res.ok) {
      setSaveNote({ ok: true, text: secrets.length > 0 ? `Saved. ${secrets.length === 1 ? "The key was" : "The keys were"} checked and work.` : "Saved." });
      const box = formEl.elements.namedItem("secrets");
      if (box instanceof HTMLTextAreaElement) box.value = "";
    } else {
      setSaveNote({ ok: false, text: res.error });
    }
  }

  const reorder = (next: KeySummary[] | null) => {
    if (next) void run(() => services.keys.reorderKeys(next.map((x) => x.id))).then((r) => !r.ok && toast(r.error));
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className={`inline-flex transition-transform ${open ? "rotate-90" : ""}`}><Icon name="right" size={18} /></span>
        <h2 className="font-serif text-xl">{PROVIDER_LABELS[provider]}</h2>
        <span className="text-sm text-neutral-500">{keys.length === 1 ? "1 key" : `${keys.length} keys`}</span>
        {/* Shown only while closed; opened, each key carries its own mark. */}
        {!open && <span className="ml-auto"><Mark ok={summary} label={summary === false ? "A key is not working" : "Keys are working"} /></span>}
      </button>

      {open && (
        <>
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
                  placeholder="One model name per line"
                  className={`${AREA} font-mono text-sm`}
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
                placeholder="Paste a key here, one per line"
                className={`${AREA} font-mono text-sm`}
              />
            </label>

            <button type="submit" disabled={busy} className={primary}>{busy ? "Working…" : "Check and save"}</button>
            {saveNote && (
              <p role="status" className={`flex items-start gap-2 text-sm ${saveNote.ok ? "text-green-700 dark:text-green-500" : "text-red-600"}`}>
                <Mark ok={saveNote.ok} />
                <span>{saveNote.text}</span>
              </p>
            )}
          </form>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Saved keys (tried top to bottom)</h3>
              {keys.length > 1 && (
                <button type="button" className={small} disabled={busy || testing.length > 0} onClick={() => onTest(keys.map((k) => k.id))}>Test all</button>
              )}
            </div>
            {keys.length === 0 && <p className="text-sm text-neutral-500">No keys saved yet.</p>}
            <ul className="flex flex-col gap-2">
              {keys.map((k, i) => (
                <li key={k.id} className="flex flex-col gap-1 rounded-2xl bg-white p-3 dark:bg-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm">
                      {testing.includes(k.id) ? <span aria-label="Testing" className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" /> : <Mark ok={k.lastOk} label={k.lastMessage} />}
                      Key …{k.hint}
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      <button type="button" className={small} disabled={busy || i === 0} onClick={() => reorder(moved(keys, i, -1))}>↑</button>
                      <button type="button" className={small} disabled={busy || i === keys.length - 1} onClick={() => reorder(moved(keys, i, 1))}>↓</button>
                      <button type="button" className={small} disabled={busy || testing.includes(k.id)} onClick={() => onTest([k.id])}>Test</button>
                      <button type="button" className={small} disabled={busy}
                        onClick={() => void run(() => services.keys.removeKey(k.id)).then((r) => toast(r.ok ? "Key removed." : r.error))}>Remove</button>
                    </span>
                  </div>
                  {k.lastOk === false && k.lastMessage && <p className="pl-6 text-xs text-red-600">{k.lastMessage}</p>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

export default function KeysPage() {
  const ready = useRequireSession();
  const [config, setConfig] = useState<KeyConfig>({ keys: [], models: [], providerOrder: ["gemini", "openai", "claude"] });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await services.keys.load();
    if (res.ok) setConfig(res.value);
    else toast(res.error);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [ready, load]);

  const run: Run = async (action) => {
    setBusy(true);
    const res = await action();
    await load();
    setBusy(false);
    return res;
  };

  /** Tests exactly these keys, one after another. The server keeps each answer with the key, so reloading shows the marks. */
  async function onTest(ids: string[]) {
    for (const id of ids) {
      setTesting((now) => [...now, id]);
      const res = await services.keys.testKeys(id);
      if (!res.ok) toast(res.error);
      await load();
      setTesting((now) => now.filter((x) => x !== id));
    }
  }

  if (!ready) return null;

  const order = config.providerOrder;
  const swapProvider = (index: number, by: -1 | 1) => {
    const next = moved<AiKeyProvider>(order, index, by);
    if (next) void run(() => services.keys.reorderProviders(next)).then((r) => !r.ok && toast(r.error));
  };

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-6 px-6 py-10">
      <h1 className="font-serif text-3xl tracking-tight">API keys</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Keys are stored encrypted on the server and never shown again. A scan tries providers in the order
        below; for each provider it tries every model, and for each model every key. A tick means a key worked the last
        time it was used or tested; a cross means it was refused. No mark means it has not been tried yet.
      </p>

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
        <ProviderSection key={provider} provider={provider} config={config} busy={busy} testing={testing} run={run} onTest={onTest} />
      ))}
    </main>
  );
}
