// app/profile/watch/page.tsx
// Where the Watch button goes: link templates for movies, shows, episodes and search.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { FIELD_FULL } from "@/components/ui/fields";
import { toast } from "@/components/Toast";
import { useEffect, useState } from "react";
import RoundButton from "@/components/RoundButton";
import { useRequireSession } from "@/hooks/useRequireSession";
import { EMPTY_WATCH_LINKS, fillTemplate, PLACEHOLDERS, watchLinksSchema, type WatchContext, type WatchLinks } from "@/lib/domain/watchLinks";
import { services } from "@/lib/services";
import { forgetWatchChecks } from "@/lib/watch";

const FIELDS: { key: keyof WatchLinks; label: string; hint: string; example: string }[] = [
  { key: "movie", label: "Movie link", hint: "Opens for any movie.", example: "https://example.org/movies/{tmdb}" },
  { key: "show", label: "Show link", hint: "Opens for any TV show.", example: "https://example.org/tv/{tmdb}" },
  { key: "episode", label: "Episode link", hint: "Opens for a viewing logged as one episode.", example: "https://example.org/tv/{tmdb}?season={season}&episode={episode}" },
  { key: "search", label: "Search link", hint: "Used when the exact page is missing, or the title has no TMDB match.", example: "https://example.org/search?query={title}" },
];

const SAMPLE: WatchContext = { tmdbId: 1368337, kind: "TV Show", title: "The Odyssey", year: "2026", season: 1, episode: 2 };

const input = FIELD_FULL;

export default function WatchSettingsPage() {
  const ready = useRequireSession();
  const [links, setLinks] = useState<WatchLinks>(EMPTY_WATCH_LINKS);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.settings.watchLinks().then((res) => {
      if (cancelled) return;
      if (res.ok) setLinks(res.value);
      else setProblem(res.error);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const parsed = watchLinksSchema.safeParse(links);
  const issues = new Map<string, string>(parsed.success ? [] : parsed.error.issues.map((i) => [String(i.path[0]), i.message]));

  async function save() {
    if (!parsed.success) return;
    setBusy(true);
    setProblem(null);
    const res = await services.settings.saveWatchLinks(parsed.data);
    if (res.ok) {
      forgetWatchChecks();
      setSaved(true);
      toast("Watch link saved");
    } else setProblem(res.error);
    setBusy(false);
  }

  if (!ready) return null;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-5 px-6 pb-4 pt-2">
      <h1 className="font-serif text-3xl tracking-tight">Watch link</h1>
      <p className="text-sm text-neutral-500">Tell the Watch button which website to open. Put a placeholder where the title goes and it is filled in for each movie or show. Nothing is set by default.</p>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      {FIELDS.map((field) => {
        const value = links[field.key];
        const preview = value && !issues.has(field.key) ? fillTemplate(value, SAMPLE) : null;
        return (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium">{field.label}</span>
            <input
              className={input}
              value={value}
              disabled={!loaded}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={field.example}
              onChange={(e) => {
                setSaved(false);
                setLinks({ ...links, [field.key]: e.target.value });
              }}
            />
            <span className="px-1 text-xs text-neutral-500">{field.hint}</span>
            {issues.has(field.key) && <span role="alert" className="px-1 text-xs text-red-600">{issues.get(field.key)}</span>}
            {preview && <span className="break-all px-1 text-xs text-neutral-500">Example: {preview}</span>}
          </label>
        );
      })}

      <section className="flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        <h2 className="font-serif text-lg">Placeholders</h2>
        <ul className="flex flex-col gap-1">
          {PLACEHOLDERS.map((p) => (
            <li key={p.token}><code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{p.token}</code> <span className="text-neutral-500">{p.note}</span></li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">Examples above use &ldquo;The Odyssey&rdquo; as a sample title. Links must start with https://.</p>
      </section>

      <div className="flex items-center gap-3">
        <RoundButton icon="check" label="Save" tone="dark" size="lg" disabled={busy || !parsed.success || !loaded} onClick={save} />
        {saved && <span role="status" className="text-sm">Saved</span>}
      </div>
    </main>
  );
}
