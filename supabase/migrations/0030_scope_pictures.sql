-- Pictures for things that are not saved titles: a season, an episode or a movie collection.
-- A picture you upload belongs to a "scope" (for example collection:10), and the choice of which picture a page uses is kept here.
alter table public.images add column if not exists scope text;
create index if not exists images_scope on public.images (scope);

create table if not exists public.picture_choices (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null,
  kind text not null check (kind in ('poster', 'backdrop')),
  -- A TMDB picture path, or the link of a picture you uploaded.
  value text not null,
  primary key (user_id, scope, kind)
);
alter table public.picture_choices enable row level security;
drop policy if exists "owner only" on public.picture_choices;
create policy "owner only" on public.picture_choices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.picture_choices from anon;
