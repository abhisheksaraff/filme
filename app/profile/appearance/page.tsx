// app/profile/appearance/page.tsx
// Light or dark, and whether holiday themes tint the app.
"use client";

import { useEffect, useState } from "react";
import BackLink from "@/components/BackLink";
import { useRequireSession } from "@/hooks/useRequireSession";
import { DEFAULT_APPEARANCE, type Appearance } from "@/lib/domain/appearance";
import { HOLIDAYS, activeHoliday } from "@/lib/domain/holidays";
import { services } from "@/lib/services";
import { changeAppearance, readCachedAppearance } from "@/lib/theme";

const MODES: { value: Appearance["themeMode"]; label: string }[] = [
  { value: "system", label: "Match my phone" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

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

  if (!ready) return null;

  const today = activeHoliday(new Date(), appearance);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8">
      <BackLink fallback="/profile/" />
      <h1 className="font-serif text-3xl tracking-tight">Appearance</h1>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-serif text-xl">Mode</legend>
        {MODES.map((mode) => (
          <label key={mode.value} className="flex items-center gap-3 text-base">
            <input
              type="radio"
              name="mode"
              className="h-5 w-5"
              checked={appearance.themeMode === mode.value}
              onChange={() => update({ ...appearance, themeMode: mode.value })}
            />
            {mode.label}
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">Holiday themes</h2>
        <label className="flex items-center gap-3 text-base">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={appearance.holidayThemeEnabled}
            onChange={(e) => update({ ...appearance, holidayThemeEnabled: e.target.checked })}
          />
          Tint the app around holidays
        </label>

        {appearance.holidayThemeEnabled && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">Show</span>
              <select
                // 16px keeps iOS Safari from zooming the page when the field is focused.
                className="rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-base dark:border-neutral-700"
                value={appearance.holidayTheme ?? ""}
                onChange={(e) => update({ ...appearance, holidayTheme: e.target.value || null })}
              >
                <option value="">Automatically, by date</option>
                {HOLIDAYS.map((holiday) => (
                  <option key={holiday.slug} value={holiday.slug}>{holiday.emoji} {holiday.name}</option>
                ))}
              </select>
            </label>
            <p className="text-sm text-neutral-500">
              {today ? `Showing ${today.emoji} ${today.name}.` : "No holiday right now, so nothing is tinted."}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
