-- 0001_schema.sql
-- Core tables for the Filme log. Run once in the Supabase SQL editor (or via the CLI).
-- Conventions: uuid primary keys, timestamptz audit columns, TMDB ids kept as plain integers
-- so a title can exist without TMDB (source = 'custom').

create extension if not exists pg_trgm;   -- fuzzy title search
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- Keeps updated_at honest without every client having to remember to set it.
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- catalog

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tmdb' check (source in ('tmdb', 'custom')),
  tmdb_id integer,
  imdb_id text,
  category text not null check (category in ('Movie', 'TV Show', 'Concert', 'Live Event')),
  title text not null,
  original_title text,
  original_language text,
  release_date text,                 -- text: custom items may only know a year
  runtime integer,
  overview text,
  vote_average numeric,
  vote_count integer,
  poster_path text,
  backdrop_path text,
  last_synced_at timestamptz,        -- drives the monthly "re-check TMDB" refresh
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, ''))
  ) stored
);
create unique index media_items_tmdb_uniq on public.media_items (category, tmdb_id) where tmdb_id is not null;
create index media_items_search_idx on public.media_items using gin (search);
create index media_items_title_trgm on public.media_items using gin (title gin_trgm_ops);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_items (id) on delete cascade,
  season_number integer not null check (season_number >= 0),
  name text,
  episode_count integer,
  air_date text,
  unique (media_id, season_number)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  episode_number integer not null check (episode_number >= 0),
  name text,
  air_date text,
  runtime integer,
  unique (season_id, episode_number)
);

-- One table for every person; the role lives on the link so an actor can also be a director.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique,
  musicbrainz_id text unique,
  name text not null,
  profile_path text,
  updated_at timestamptz not null default now()
);
create index people_name_trgm on public.people using gin (name gin_trgm_ops);

create table public.media_people (
  media_id uuid not null references public.media_items (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null check (role in ('actor', 'director', 'producer', 'writer', 'creator', 'performer', 'opener')),
  character text,
  billing_order integer,
  primary key (media_id, person_id, role)
);
create index media_people_person_idx on public.media_people (person_id);

create table public.genres (id integer primary key, name text not null unique);
create table public.media_genres (
  media_id uuid not null references public.media_items (id) on delete cascade,
  genre_id integer not null references public.genres (id),
  primary key (media_id, genre_id)
);

create table public.keywords (id integer primary key, name text not null);
create table public.media_keywords (
  media_id uuid not null references public.media_items (id) on delete cascade,
  keyword_id integer not null references public.keywords (id),
  primary key (media_id, keyword_id)
);

create table public.companies (id integer primary key, name text not null);
create table public.media_companies (
  media_id uuid not null references public.media_items (id) on delete cascade,
  company_id integer not null references public.companies (id),
  primary key (media_id, company_id)
);

-- ---------------------------------------------------------------- the user's log

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'cinema'
    check (type in ('cinema', 'theatre', 'arena', 'stadium', 'club', 'festival', 'home', 'other')),
  address text,
  city text,
  country text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create table public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete restrict,
  venue_id uuid references public.venues (id) on delete set null,
  scope text not null default 'show' check (scope in ('show', 'season', 'episode')),
  season_number integer,
  episode_number integer,
  watched_on text,                   -- YYYY, YYYY-MM or YYYY-MM-DD depending on date_precision
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year', 'unknown')),
  watched_at text,                   -- time of day as printed on the ticket, e.g. "7:30 PM"
  status text not null default 'watched' check (status in ('watched', 'in_progress', 'dropped')),
  rating numeric check (rating between 1 and 10 and (rating * 2) = round(rating * 2)),
  notes text,
  primary_format text,
  addons text[] not null default '{}',
  auditorium text,
  seats jsonb not null default '[]',
  total_tickets integer check (total_tickets >= 0),
  batch_id uuid,                     -- groups sessions created together (e.g. a whole season)
  deleted_at timestamptz,            -- soft delete; a weekly job purges rows after the undo window
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index watch_sessions_media_idx on public.watch_sessions (media_id);
create index watch_sessions_date_idx on public.watch_sessions (watched_on) where deleted_at is null;

create table public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('poster', 'backdrop', 'ticket', 'photo', 'profile', 'avatar')),
  source text not null check (source in ('tmdb', 'upload')),
  path text not null,
  note text,
  is_default boolean not null default false,
  media_id uuid references public.media_items (id) on delete cascade,
  session_id uuid references public.watch_sessions (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.want_to_watch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  note text,
  added_at timestamptz not null default now(),
  unique (user_id, media_id)
);

-- ---------------------------------------------------------------- holidays and themes

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  date_type text not null check (date_type in ('fixed', 'rule', 'moving')),
  fixed_month integer check (fixed_month between 1 and 12),
  fixed_day integer check (fixed_day between 1 and 31),
  theme text,
  keywords text[] not null default '{}'
);

-- Resolved dates per year; "moving" holidays are filled once a year from one validated AI request.
create table public.holiday_dates (
  holiday_id uuid not null references public.holidays (id) on delete cascade,
  year integer not null,
  starts_on date not null,
  ends_on date not null,
  primary key (holiday_id, year)
);

create table public.holiday_overrides (
  holiday_id uuid primary key references public.holidays (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default true
);

-- ---------------------------------------------------------------- collections and extras

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  holiday_id uuid references public.holidays (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  media_id uuid not null references public.media_items (id) on delete cascade,
  position integer,
  primary key (collection_id, media_id)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  row_key text not null,
  media_id uuid not null references public.media_items (id) on delete cascade,
  score numeric,
  generated_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('day', 'month', 'year')),
  period text not null,              -- e.g. 2026-11-14, 2026-11 or 2026
  payload jsonb not null default '{}',
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, period)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  body jsonb not null default '{}',
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme_mode text not null default 'system' check (theme_mode in ('light', 'dark', 'system')),
  holiday_theme text,
  holiday_theme_enabled boolean not null default true,
  home_layout jsonb not null default '[]',
  holiday_dates_year integer,
  updated_at timestamptz not null default now()
);

-- API keys, encrypted in the browser with a key derived from the user's password before upload.
-- The database only ever sees ciphertext; it cannot decrypt these.
create table public.user_secrets (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kdf_salt text not null,
  kdf_iterations integer not null,
  iv text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- updated_at triggers

create trigger media_items_touch before update on public.media_items for each row execute function public.set_updated_at();
create trigger people_touch before update on public.people for each row execute function public.set_updated_at();
create trigger watch_sessions_touch before update on public.watch_sessions for each row execute function public.set_updated_at();
create trigger user_settings_touch before update on public.user_settings for each row execute function public.set_updated_at();
create trigger user_secrets_touch before update on public.user_secrets for each row execute function public.set_updated_at();
