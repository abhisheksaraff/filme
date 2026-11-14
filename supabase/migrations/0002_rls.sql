-- 0002_rls.sql
-- Row Level Security: the browser holds only the public (publishable) key, so these policies
-- are the real access control. Nothing is readable or writable without a signed-in user.
-- Every new table needs its own policy in the migration that creates it;
-- supabase/tests/rls.sql fails if a public table is left without RLS.

do $$
declare
  t text;
  -- Rows that belong to the signed-in user.
  owned text[] := array[
    'venues', 'watch_sessions', 'images', 'want_to_watch', 'holiday_overrides', 'collections',
    'recommendations', 'stories', 'notifications', 'user_settings', 'user_secrets'
  ];
  -- Shared catalog data. The app has a single account, so any signed-in user may use it.
  shared text[] := array[
    'media_items', 'seasons', 'episodes', 'people', 'media_people', 'genres', 'media_genres',
    'keywords', 'media_keywords', 'companies', 'media_companies', 'holidays', 'holiday_dates',
    'collection_items'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;

  foreach t in array shared loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "signed in only" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Belt and braces: the anon role gets no table privileges at all.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
