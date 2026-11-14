// app/profile/appearance/page.tsx
// Light or dark, which theme to wear, floating decorations and the birthday that triggers a theme.
"use client";

import { useEffect, useState } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { DEFAULT_APPEARANCE, type Appearance } from "@/lib/domain/appearance";
import { MONTH_NAMES } from "@/lib/domain/stats";
import { THEMES } from "@/lib/domain/holidays";
import { services } from "@/lib/services";
import { changeAppearance, currentTheme, readCachedAppearance } from "@/lib/theme";

const MODES: { value: Appearance["themeMode"]; label: string }[] = [
  { value: "system", label: "Match my phone" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** What the theme choice is, in one value: plain, by the calendar, or one theme. */
type Choice = "plain" | "auto" | string;

const choiceOf = (a: Appearance): Choice => (a.holidayTheme ? a.holidayTheme : a.holidayThemeEnabled ? "auto" : "plain");

export default function AppearancePage() {
  const ready = useRequireSession();
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    services.settings.appearance().then((res) => {
      if (cancelled) return;
      if (res.ok) setAppearance(res.value);
      else {
        setProblem(res.error);
        setAppearance(readCachedAppearance());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function update(next: Appearance) {
    const before = appearance;
    setAppearance(next);
    setProblem(null);
    changeAppearance(next);
    const res = await services.settings.saveAppearance(next);
    if (!res.ok) {
      setProblem(res.error);
      setAppearance(before);
      changeAppearance(before);
    }
  }

  function choose(choice: Choice) {
    if (choice === "plain") update({ ...appearance, holidayThemeEnabled: false, holidayTheme: null });
    else if (choice === "auto") update({ ...appearance, holidayThemeEnabled: true, holidayTheme: null });
    else update({ ...appearance, holidayThemeEnabled: true, holidayTheme: choice });
  }

  if (!ready) return null;

  const today = currentTheme(appearance);
  const choice = choiceOf(appearance);
  const [month, day] = (appearance.birthday ?? "").split("-").map(Number);
  const field = "rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-base dark:border-neutral-700";

  const setBirthday = (m: number, d: number) =>
    update({ ...appearance, birthday: `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-12 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Appearance</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-serif text-xl">Mode</legend>
        {MODES.map((mode) => (
          <label key={mode.value} className="flex items-center gap-3 text-base">
            <input type="radio" name="mode" className="h-5 w-5" checked={appearance.themeMode === mode.value} onChange={() => update({ ...appearance, themeMode: mode.value })} />
            {mode.label}
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">Theme</h2>
        <p className="text-sm text-neutral-500">
          {today ? `Showing ${today.emoji} ${today.name}.` : "Plain look right now."} A theme you pick stays until you change it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: "plain", name: "Plain", emoji: "◻️" }, { id: "auto", name: "By the calendar", emoji: "📅" }, ...THEMES.map((t) => ({ id: t.slug, name: t.name, emoji: t.emoji }))].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              aria-pressed={choice === option.id}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${choice === option.id ? "border-neutral-900 font-medium dark:border-white" : "border-neutral-300 dark:border-neutral-700"}`}
            >
              <span className="mr-1">{option.emoji}</span>{option.name}
            </button>
          ))}
        </div>
      </section>

      <label className="flex items-center gap-3 text-base">
        <input type="checkbox" className="h-5 w-5" checked={appearance.decorationsEnabled} onChange={(e) => update({ ...appearance, decorationsEnabled: e.target.checked })} />
        Floating decorations on themes
      </label>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl">Birthday</h2>
        <p className="text-sm text-neutral-500">The birthday theme shows for the day before, the day, and the day after.</p>
        <div className="flex gap-2">
          <select className={field} aria-label="Month" value={month || 8} onChange={(e) => setBirthday(Number(e.target.value), day || 25)}>
            {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
          <select className={field} aria-label="Day" value={day || 25} onChange={(e) => setBirthday(month || 8, Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      </section>
    </main>
  );
}
