// components/ui/fields.ts
// The one look for text fields, dropdowns and date pickers: a soft grey fill and no border, like the add-entry page.
// 16px text stops iOS Safari from zooming the page when a field is focused; placeholders get their grey from the global stylesheet.
export const FIELD = "rounded-2xl bg-neutral-100 px-4 py-3 text-base outline-none dark:bg-neutral-800";
/** The same, stretched across its row. */
export const FIELD_FULL = `w-full ${FIELD}`;
