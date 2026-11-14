// scripts/rls-check.mjs
// Logged-out RLS test: using only the public key, every table must refuse reads and writes.
// Usage: node --env-file=.env.local scripts/rls-check.mjs

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!rawUrl || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.");
  process.exit(2);
}

// A URL with a path (such as /rest/v1/) makes every request miss, which once let this test pass by accident.
const parsed = new URL(rawUrl);
if (parsed.pathname !== "/" || !parsed.hostname.endsWith(".supabase.co")) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co (no path). Got: ${parsed.origin}${parsed.pathname}`);
  process.exit(2);
}
const url = parsed.origin;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const health = await fetch(`${url}/auth/v1/health`, { headers }).catch(() => null);
if (!health || !health.ok) {
  console.error(`Could not reach ${url}/auth/v1/health (status ${health?.status ?? "no response"}). Check the URL and key.`);
  process.exit(2);
}

const tables = [
  "media_items", "seasons", "episodes", "people", "media_people", "genres", "media_genres",
  "keywords", "media_keywords", "companies", "media_companies", "venues", "watch_sessions",
  "images", "want_to_watch", "holidays", "holiday_dates", "holiday_overrides", "collections",
  "collection_items", "recommendations", "stories", "notifications", "user_settings",
  "api_keys", "usage_counters",
];

// Refusing means 401/403 (no permission). 404 means the table is missing or the URL is wrong, which proves nothing.
const refused = (status) => status === 401 || status === 403;

let failures = 0;
const fail = (table, why) => {
  console.error(`FAIL  ${table}: ${why}`);
  failures++;
};

for (const table of tables) {
  const read = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  if (read.status === 404) {
    fail(table, "not found (missing table or wrong URL)");
    continue;
  }
  if (read.ok) {
    const rows = await read.json();
    if (rows.length > 0) fail(table, "logged-out read returned data");
  } else if (!refused(read.status)) {
    fail(table, `unexpected read status ${read.status}`);
  }

  const write = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: "{}" });
  if (!refused(write.status)) {
    fail(table, `logged-out insert was not refused (status ${write.status})`);
    continue;
  }
  console.log(`ok    ${table}`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found. Do not deploy.`);
  process.exit(1);
}
console.log("\nAll tables refused logged-out access.");
