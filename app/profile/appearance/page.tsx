// app/profile/appearance/page.tsx
// Light or dark, which theme to wear, floating decorations and the birthday that triggers a theme.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { useEffect, useState } from "react";
import Choice from "@/components/ui/Choice";
import { FIELD } from "@/components/ui/fields";
import ThemeIcon from "@/components/ThemeIcon";
import { useRequireSession } from "@/hooks/useRequireSession";
import { DEFAULT_APPEARANCE, type Appearance } from "@/lib/domain/appearance";
import { MONTH_NAMES } from "@/lib/domain/stats";
import { THEMES } from "@/lib/domain/holidays";
import { services } from "@/lib/services";
import { appearancePending, changeAppearance, readCachedAppearance, setAppearancePending } from "@/lib/theme";

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
    // Open on the look this phone already shows, so the controls always agree with it; the account's answer then replaces it if different.
    const first = setTimeout(() => {
      if (!cancelled) setAppearance(readCachedAppearance());
    }, 0);
    services.settings.appearance().then((res) => {
      if (cancelled) return;
      // A change still waiting to be saved is newer than the account's copy, so the account's copy must not replace it.
      if (res.ok && !appearancePending()) {
        setAppearance(res.value);
        changeAppearance(res.value);
      } else if (!res.ok) setProblem(res.error);
    });
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, [ready]);

  async function update(next: Appearance) {
    setAppearance(next);
    setProblem(null);
    changeAppearance(next);
    const res = await services.settings.saveAppearance(next);
    // A choice that could not be saved stays on this phone and is sent again the next time the app opens.
    setAppearancePending(!res.ok);
    if (!res.ok) setProblem(res.error);
  }

  function choose(choice: Choice) {
    if (choice === "plain") update({ ...appearance, holidayThemeEnabled: false, holidayTheme: null });
    else if (choice === "auto") update({ ...appearance, holidayThemeEnabled: true, holidayTheme: null });
    else update({ ...appearance, holidayThemeEnabled: true, holidayTheme: choice });
  }

  if (!ready) return null;

  const choice = choiceOf(appearance);
  const [month, day] = (appearance.birthday ?? "").split("-").map(Number);
  const field = FIELD;

  const setBirthday = (m: number, d: number) =>
    update({ ...appearance, birthday: `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-3xl lg:max-w-5xl flex-col gap-6 px-6 pb-4 pt-8">
      <h1 className="font-serif text-3xl tracking-tight">Appearance</h1>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-serif text-xl">Mode</legend>
        {MODES.map((mode) => (
          <Choice key={mode.value} type="radio" name="mode" checked={appearance.themeMode === mode.value} onChange={() => update({ ...appearance, themeMode: mode.value })}>
            {mode.label}
          </Choice>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">Theme</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {[{ id: "plain", name: "Plain" }, { id: "auto", name: "By the calendar" }, ...THEMES.map((t) => ({ id: t.slug, name: t.name }))].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              aria-pressed={choice === option.id}
              className={`flex items-center gap-2.5 rounded-full px-4 py-3 text-left text-sm ${choice === option.id ? "bg-neutral-950 font-medium text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 dark:bg-neutral-800"}`}
            >
              <ThemeIcon slug={option.id} />
              <span className="min-w-0">{option.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Choice type="checkbox" checked={appearance.animationsEnabled} onChange={(checked) => update({ ...appearance, animationsEnabled: checked })}>
          Enable animated backgrounds
        </Choice>
        <Choice type="checkbox" checked={appearance.decorationsEnabled} onChange={(checked) => update({ ...appearance, decorationsEnabled: checked })}>
          Enable decorations
        </Choice>
      </div>

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
