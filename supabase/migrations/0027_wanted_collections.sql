-- A movie collection saved to the Watchlist: the collection itself, not its films.
alter table public.collection_follows add column if not exists name text;
alter table public.collection_follows add column if not exists poster_path text;
alter table public.collection_follows add column if not exists wanted_at timestamptz;
