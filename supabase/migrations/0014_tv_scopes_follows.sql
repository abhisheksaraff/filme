-- 0014_tv_scopes_follows.sql
-- TV shows: one viewing per series, season or episode, a watchlist per scope, and followed shows.

-- What a viewing covered, so statistics count real episodes and minutes instead of one row per episode.
alter table public.watch_sessions add column if not exists episodes_covered integer check (episodes_covered >= 0);
alter table public.watch_sessions add column if not exists seasons_covered integer check (seasons_covered >= 0);
alter table public.watch_sessions add column if not exists minutes integer check (minutes >= 0);

-- A watchlist row can now be a whole show, one season or one episode.
alter table public.want_to_watch add column if not exists season_number integer check (season_number >= 0);
alter table public.want_to_watch add column if not exists episode_number integer check (episode_number >= 0);
alter table public.want_to_watch drop constraint if exists want_to_watch_user_id_media_id_key;
create unique index if not exists want_to_watch_scope_uniq
  on public.want_to_watch (user_id, media_id, coalesce(season_number, -1), coalesce(episode_number, -1));

-- Shows followed for new episodes. "on" and "off" override the automatic rule (watched in the last year and still running);
-- the aired_* columns hold the latest aired episode found by the daily check.
create table if not exists public.show_follows (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  mode text check (mode in ('on', 'off')),
  running boolean,
  aired_season integer,
  aired_episode integer,
  aired_on text,
  aired_name text,
  checked_on text,
  primary key (user_id, media_id)
);
alter table public.show_follows enable row level security;
drop policy if exists "owner only" on public.show_follows;
create policy "owner only" on public.show_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.show_follows from anon;
