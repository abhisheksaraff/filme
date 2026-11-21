-- 0025_tv_passes.sql
-- TV rewatches: resets of a rewatch in progress, and edits to a season's or series' completion card.

-- "Reset this rewatch": the viewings stay, but episodes watched before this moment stop counting toward the current pass.
-- season is null for the whole series.
create table if not exists public.tv_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  season integer,
  reset_at timestamptz not null default now()
);
create index if not exists tv_resets_media on public.tv_resets (user_id, media_id);

-- Hand edits to a completion card. It mirrors the last episode until edited; then these fields win.
-- season = -1 for a series card; pass_key is the id of the first viewing in that pass, so the edit survives the card reopening.
create table if not exists public.tv_stack_edits (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  season integer not null default -1,
  pass_key text not null,
  fields jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id, season, pass_key)
);

alter table public.tv_resets enable row level security;
alter table public.tv_stack_edits enable row level security;
drop policy if exists "owner only" on public.tv_resets;
drop policy if exists "owner only" on public.tv_stack_edits;
create policy "owner only" on public.tv_resets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner only" on public.tv_stack_edits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.tv_resets from anon;
revoke all on public.tv_stack_edits from anon;
