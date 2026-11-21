-- Completion cards now copy only the last viewing's date, time and place. The stored cards, their edits and their own pictures
-- are cleared; the app rebuilds the cards from the viewings the next time it opens.
delete from public.tv_stack_edits;
delete from public.tv_completions;

-- IMDb page and rating of single episodes, saved the first time a card asks for them.
create table if not exists public.episode_scores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  season integer not null,
  episode integer not null,
  imdb_id text,
  imdb_rating numeric,
  checked_at timestamptz not null default now(),
  primary key (user_id, media_id, season, episode)
);
alter table public.episode_scores enable row level security;
drop policy if exists "owner only" on public.episode_scores;
create policy "owner only" on public.episode_scores for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.episode_scores from anon;
