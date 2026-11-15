-- 0012_imdb_related_watchlist_cleared.sql
-- OMDb keys, saved IMDb ratings, a saved "related people" list, and Watchlist items marked cleared once watched.

-- OMDb is a new kind of key (used only to read IMDb ratings).
alter table public.api_keys drop constraint if exists api_keys_provider_check;
alter table public.api_keys add constraint api_keys_provider_check
  check (provider in ('gemini', 'openai', 'claude', 'tmdb', 'omdb'));

-- IMDb's rating for a title and when it was last looked up (a lookup that found none still sets the date).
alter table public.media_items add column if not exists imdb_rating numeric;
alter table public.media_items add column if not exists imdb_rating_at timestamptz;

-- A Watchlist item is cleared, not deleted, once the title has been watched, so it can be counted.
alter table public.want_to_watch add column if not exists cleared_at timestamptz;
update public.want_to_watch w
set cleared_at = greatest(w.added_at, (
  select min(s.created_at) from public.watch_sessions s
  where s.media_id = w.media_id and s.user_id = w.user_id and s.deleted_at is null
))
where w.cleared_at is null
  and exists (
    select 1 from public.watch_sessions s
    where s.media_id = w.media_id and s.user_id = w.user_id and s.deleted_at is null
  );

-- The people who most often work with a person, worked out from TMDB once and kept.
create table if not exists public.related_people (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  people jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (user_id, tmdb_id)
);
alter table public.related_people enable row level security;
create policy "owner only" on public.related_people for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.related_people from anon;
