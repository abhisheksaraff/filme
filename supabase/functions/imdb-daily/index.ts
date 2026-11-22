// supabase/functions/imdb-daily/index.ts
// Once a day (started by the schedule in migration 0031): reads IMDb's own published ratings file and fills in the IMDb rating
// of every saved title, listed title and episode that has none yet or a week-old one. Only ratings of titles already in the app are
// kept; the rest of the file is skipped. OMDb is not used, so no daily limit is spent.
import { adminClient } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";

const FILE = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;
const AT_ONCE = 10;

type Wanted = Map<number, string>; // IMDb number (tt0123456 -> 123456) -> the full id

/** Constant-time text compare, so the schedule's key cannot be guessed from timing. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const numberOf = (id: string): number | null => (/^tt\d{5,10}$/.test(id) ? Number(id.slice(2)) : null);

/** Every row of a table (a page at a time) whose rating is missing or older than a week. */
async function stale<T extends Record<string, unknown>>(table: string, columns: string, idCol: string, atCol: string): Promise<T[]> {
  const db = adminClient();
  const cutoff = new Date(Date.now() - WEEK_MS).toISOString();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .not(idCol, "is", null)
      .or(`${atCol}.is.null,${atCol}.lt.${cutoff}`)
      .order(idCol)
      .range(from, from + PAGE - 1);
    if (error) throw new HttpError(500, "Could not read the saved titles.");
    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Streams the ratings file and returns the rating for each wanted id that it holds. Works on raw bytes so it stays fast. */
async function readRatings(wanted: Wanted): Promise<Map<number, number>> {
  const res = await fetch(FILE, { signal: AbortSignal.timeout(100_000) });
  if (!res.ok || !res.body) throw new HttpError(502, "Could not download IMDb's ratings file.");
  const reader = res.body.pipeThrough(new DecompressionStream("gzip")).getReader();
  const found = new Map<number, number>();
  const text = new TextDecoder();
  let carry = new Uint8Array(0);

  const line = (buf: Uint8Array, start: number, end: number) => {
    // "tt" + digits, a tab, then the rating (such as 7.3), a tab and the vote count.
    if (end - start < 12 || buf[start] !== 116 || buf[start + 1] !== 116) return;
    let n = 0;
    let i = start + 2;
    for (; i < end && buf[i] !== 9; i++) {
      const d = buf[i] - 48;
      if (d < 0 || d > 9) return;
      n = n * 10 + d;
    }
    if (!wanted.has(n)) return;
    let j = i + 1;
    while (j < end && buf[j] !== 9) j++;
    const rating = Number(text.decode(buf.subarray(i + 1, j)));
    if (Number.isFinite(rating) && rating > 0) found.set(n, rating);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let buf = value;
    if (carry.length > 0) {
      buf = new Uint8Array(carry.length + value.length);
      buf.set(carry);
      buf.set(value, carry.length);
    }
    let start = 0;
    for (let nl = buf.indexOf(10, start); nl !== -1; nl = buf.indexOf(10, start)) {
      line(buf, start, nl);
      start = nl + 1;
    }
    carry = buf.slice(start);
  }
  if (carry.length > 0) line(carry, 0, carry.length);
  return found;
}

/** Runs the updates a few at a time. */
async function each<T>(items: T[], work: (item: T) => PromiseLike<unknown>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await work(item);
    }),
  );
}

serve(async (req) => {
  // SECURITY: only the daily schedule may start this. It sends the project's service key, which nobody else holds.
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sent = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!key || !same(sent, key)) throw new HttpError(401, "Not allowed.");

  const db = adminClient();
  const [media, episodes, titles] = await Promise.all([
    stale<{ id: string; imdb_id: string }>("media_items", "id, imdb_id", "imdb_id", "imdb_rating_at"),
    stale<{ user_id: string; media_id: string; season: number; episode: number; imdb_id: string }>("episode_scores", "user_id, media_id, season, episode, imdb_id", "imdb_id", "checked_at"),
    stale<{ user_id: string; category: string; tmdb_id: number; imdb_id: string }>("title_scores", "user_id, category, tmdb_id, imdb_id", "imdb_id", "imdb_checked_at"),
  ]);

  const wanted: Wanted = new Map();
  for (const row of [...media, ...episodes, ...titles]) {
    const n = numberOf(row.imdb_id);
    if (n !== null) wanted.set(n, row.imdb_id);
  }
  if (wanted.size === 0) return { wanted: 0, updated: 0 };

  const ratings = await readRatings(wanted);
  const now = new Date().toISOString();
  const ratingOf = (id: string) => ratings.get(numberOf(id) ?? -1);
  let updated = 0;

  await each(media, async (r) => {
    const rating = ratingOf(r.imdb_id);
    if (rating === undefined) return;
    const { error } = await db.from("media_items").update({ imdb_rating: rating, imdb_rating_at: now }).eq("id", r.id);
    if (!error) updated++;
  });
  await each(episodes, async (r) => {
    const rating = ratingOf(r.imdb_id);
    if (rating === undefined) return;
    const { error } = await db.from("episode_scores").update({ imdb_rating: rating, checked_at: now }).eq("user_id", r.user_id).eq("media_id", r.media_id).eq("season", r.season).eq("episode", r.episode);
    if (!error) updated++;
  });
  await each(titles, async (r) => {
    const rating = ratingOf(r.imdb_id);
    if (rating === undefined) return;
    const { error } = await db.from("title_scores").update({ imdb_rating: rating, imdb_checked_at: now }).eq("user_id", r.user_id).eq("category", r.category).eq("tmdb_id", r.tmdb_id);
    if (!error) updated++;
  });

  return { wanted: wanted.size, found: ratings.size, updated };
});
