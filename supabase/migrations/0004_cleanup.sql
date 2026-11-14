-- 0004_cleanup.sql
-- Weekly housekeeping so the free tier's 500 MB is not spent on orphans.
-- Requires the pg_cron extension (Database > Extensions in the Supabase dashboard).

create extension if not exists pg_cron;

create function public.weekly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Sessions deleted more than 30 days ago have outlived the undo window.
  delete from watch_sessions where deleted_at < now() - interval '30 days';

  -- Titles nobody references: not logged, not wanted, not in a collection, and not recommended.
  delete from media_items m
  where not exists (select 1 from watch_sessions s where s.media_id = m.id)
    and not exists (select 1 from want_to_watch w where w.media_id = m.id)
    and not exists (select 1 from collection_items c where c.media_id = m.id)
    and not exists (select 1 from recommendations r where r.media_id = m.id);

  -- People with no remaining credit (and no photo the user saved).
  delete from people p
  where not exists (select 1 from media_people mp where mp.person_id = p.id)
    and not exists (select 1 from images i where i.person_id = p.id);

  delete from genres g where not exists (select 1 from media_genres x where x.genre_id = g.id);
  delete from keywords k where not exists (select 1 from media_keywords x where x.keyword_id = k.id);
  delete from companies c where not exists (select 1 from media_companies x where x.company_id = c.id);

  -- Recommendation rows are regenerated daily; keep only the last two weeks.
  delete from recommendations where generated_at < now() - interval '14 days';
end $$;

-- The function bypasses RLS, so only the database's own scheduler may run it.
revoke all on function public.weekly_cleanup() from public, anon, authenticated;

select cron.schedule('weekly-cleanup', '0 4 * * 0', 'select public.weekly_cleanup()');
