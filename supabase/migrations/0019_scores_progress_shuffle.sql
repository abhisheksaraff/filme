-- 0019_scores_progress_shuffle.sql
-- IMDb scores kept for any title that is not saved in the log, how many episodes each show has aired (so progress needs no
-- lookup each time), and the Home "random order" switch.

-- IMDb and catalogue scores by TMDB id, filled once per title and looked at again only when stale.
create table if not exists public.title_scores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('Movie', 'TV Show')),
  tmdb_id integer not null,
  imdb_id text,
  imdb_rating numeric(3, 1),
  tmdb_rating numeric(3, 1),
  released_at date,
  -- When OMDb was last asked; null means never, so the title is still to be looked up.
  imdb_checked_at timestamptz,
  primary key (user_id, category, tmdb_id)
);
alter table public.title_scores enable row level security;
drop policy if exists "owner only" on public.title_scores;
create policy "owner only" on public.title_scores for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.title_scores from anon;

-- How far each followed show has aired; a show is looked at again only when its next episode is due.
create table if not exists public.show_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  -- The title and year in lower case, so a show in the log can be found without asking TMDB which show it is.
  title_key text not null,
  aired_episodes integer not null check (aired_episodes >= 0),
  next_air_date date,
  running boolean not null default true,
  checked_at timestamptz not null default now(),
  primary key (user_id, tmdb_id)
);
create index if not exists show_progress_title_key on public.show_progress (user_id, title_key);
alter table public.show_progress enable row level security;
drop policy if exists "owner only" on public.show_progress;
create policy "owner only" on public.show_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.show_progress from anon;

-- Home rows in random order instead of the saved one.
alter table public.user_settings add column if not exists home_shuffle boolean not null default false;
