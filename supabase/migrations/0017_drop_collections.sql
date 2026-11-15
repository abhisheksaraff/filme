-- 0017_drop_collections.sql
-- Collections were never used, so the feature and its two tables are removed.
-- The weekly cleanup is rewritten first: it still looked at collection_items, which would stop existing.

create or replace function public.weekly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Sessions deleted more than 30 days ago have outlived the undo window.
  delete from watch_sessions where deleted_at < now() - interval '30 days';

  -- Titles nobody references: not logged, not wanted, and not recommended.
  delete from media_items m
  where not exists (select 1 from watch_sessions s where s.media_id = m.id)
    and not exists (select 1 from want_to_watch w where w.media_id = m.id)
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

revoke all on function public.weekly_cleanup() from public, anon, authenticated;

drop table if exists public.collection_items;
drop table if exists public.collections;
