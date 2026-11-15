-- 0013_hidden_titles_home_seen.sql
-- "Not interested" titles hidden from Home, and a record of which Home rows a saved layout already knows.

-- Titles the user never wants recommended; undone from Profile.
create table if not exists public.hidden_titles (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('Movie', 'TV Show')),
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  hidden_at timestamptz not null default now(),
  primary key (user_id, category, tmdb_id)
);
alter table public.hidden_titles enable row level security;
create policy "owner only" on public.hidden_titles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.hidden_titles from anon;

-- The Home rows a saved layout has already been offered, so rows added later appear once and stay off if turned off.
alter table public.user_settings add column if not exists home_seen jsonb;
