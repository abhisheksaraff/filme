// components/ui/fields.ts
// The one look for text fields, dropdowns and date pickers: a soft grey pill with no border, like the search bar on Home.
// 16px text stops iOS Safari from zooming the page when a field is focused; the hint text inside is smaller and grey
// (its colour comes from the global stylesheet), so what goes in a field is clear before anything is typed.
export const FIELD = "h-11 rounded-full bg-neutral-100 px-5 text-base outline-none placeholder:text-sm dark:bg-neutral-800";
/** The same, stretched across its row. */
export const FIELD_FULL = `w-full ${FIELD}`;
/** For several lines of text, where a full pill would clip: the same grey and text, with softly rounded corners. */
export const AREA = "w-full rounded-3xl bg-neutral-100 px-5 py-3 text-base outline-none placeholder:text-sm dark:bg-neutral-800";
