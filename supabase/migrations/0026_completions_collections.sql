-- 0026_completions_collections.sql
-- Stored completion cards (a season, a series or a movie collection finished), their own pictures, and movie collections.
-- Run after 0025.

-- A movie's TMDB collection (a trilogy, a franchise), filled in when it is logged or by the daily check.
alter table public.media_items add column if not exists collection_id integer;
alter table public.media_items add column if not exists collection_name text;
alter table public.media_items add column if not exists collection_checked boolean not null default false;
create index if not exists media_items_collection on public.media_items (collection_id);

-- Resets and edits can now belong to a collection instead of a show.
alter table public.tv_resets alter column media_id drop not null;
alter table public.tv_resets add column if not exists collection_id integer;
alter table public.tv_stack_edits drop constraint if exists tv_stack_edits_pkey;
alter table public.tv_stack_edits alter column media_id drop not null;
alter table public.tv_stack_edits add column if not exists collection_id integer;
create unique index if not exists tv_stack_edits_key on public.tv_stack_edits
  (user_id, coalesce(media_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(collection_id, -1), season, pass_key);

-- One row per completion card. Kept up to date whenever viewings change and by the daily check.
create table if not exists public.tv_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid references public.media_items (id) on delete cascade,
  collection_id integer,
  collection_name text,
  season integer not null default -1,
  pass_key text not null,
  last_viewing_id uuid references public.watch_sessions (id) on delete set null,
  completed_on text,
  active boolean not null default true,
  -- True once pictures were added or removed on the card itself; until then it shows the last viewing's.
  own_pictures boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists tv_completions_key on public.tv_completions
  (user_id, coalesce(media_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(collection_id, -1), season, pass_key);
alter table public.tv_completions enable row level security;
drop policy if exists "owner only" on public.tv_completions;
create policy "owner only" on public.tv_completions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.tv_completions from anon;

-- A completion card's own pictures.
alter table public.images add column if not exists completion_id uuid references public.tv_completions (id) on delete cascade;
create index if not exists images_completion on public.images (completion_id);

-- Collections taken off Home's Continue watching; one comes back when a viewing is added after `continue_removed_after`.
create table if not exists public.collection_follows (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id integer not null,
  continue_removed_after timestamptz,
  primary key (user_id, collection_id)
);
alter table public.collection_follows enable row level security;
drop policy if exists "owner only" on public.collection_follows;
create policy "owner only" on public.collection_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.collection_follows from anon;

-- "Do not recommend" on a collection.
alter table public.collection_follows add column if not exists do_not_recommend boolean not null default false;
