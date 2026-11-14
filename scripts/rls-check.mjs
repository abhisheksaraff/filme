// scripts/rls-check.mjs
// Logged-out RLS test: using only the public key, every table must refuse writes and return no rows.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... npm run test:rls

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.");
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// PostgREST publishes its schema; with no table privileges for anon it may be empty, which is fine.
const spec = await fetch(`${url}/rest/v1/`, { headers }).then((r) => (r.ok ? r.json() : { paths: {} }));
const discovered = Object.keys(spec.paths ?? {}).filter((p) => p !== "/").map((p) => p.slice(1));

// Known tables are always probed so the test still bites when discovery returns nothing.
const known = [
  "media_items", "seasons", "episodes", "people", "media_people", "genres", "media_genres",
  "keywords", "media_keywords", "companies", "media_companies", "venues", "watch_sessions",
  "images", "want_to_watch", "holidays", "holiday_dates", "holiday_overrides", "collections",
  "collection_items", "recommendations", "stories", "notifications", "user_settings", "user_secrets",
];
const tables = [...new Set([...known, ...discovered])];

let failures = 0;
for (const table of tables) {
  const read = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const rows = read.ok ? await read.json() : [];
  if (read.ok && rows.length > 0) {
    console.error(`FAIL  ${table}: logged-out read returned data`);
    failures++;
  }

  const write = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: "{}" });
  if (write.ok) {
    console.error(`FAIL  ${table}: logged-out insert was accepted`);
    failures++;
  } else {
    console.log(`ok    ${table}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found. Do not deploy.`);
  process.exit(1);
}
console.log("\nAll tables refused logged-out access.");
