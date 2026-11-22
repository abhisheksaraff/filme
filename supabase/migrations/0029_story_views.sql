-- Which Home stories (Your day, Your month, Your year) have been watched to the end, and when.
create table if not exists public.story_views (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('day', 'month', 'year')),
  period text not null,
  finished_at timestamptz not null default now(),
  primary key (user_id, kind, period)
);
alter table public.story_views enable row level security;
drop policy if exists "owner only" on public.story_views;
create policy "owner only" on public.story_views for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.story_views from anon;
